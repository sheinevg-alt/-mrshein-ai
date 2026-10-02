import { NextResponse } from 'next/server'
import {
  createApiModelsSeedance25Task,
  registerApiModelsPortrait,
  type ApiModelsResolution,
  createApiModelsCallbackToken, } from '@/lib/server/apimodels'
import {
  createStorageSignedDownloadUrl,
  hasDatabase,
  supabaseFetch,
} from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MODEL = 'seedance-2.5'
const INPUT_BUCKET = 'generation-inputs'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

function safeResolution(value: unknown): ApiModelsResolution {
  return String(value || '480p') === '720p' ? '720p' : '480p'
}

function canonicalizeTags(prompt: string) {
  return prompt
    .replace(/@video\s*(\d+)/gi, '@Video$1')
    .replace(/@image\s*(\d+)/gi, '@Image$1')
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON_BODY_REQUIRED' }, { status: 415 })
  }

  const payload = body as Record<string, unknown>
  const trendId = String(payload.trendId || '')
  const generateAudio = payload.generateAudio !== false
  const resolution = safeResolution(payload.resolution)
  const referencePaths = (Array.isArray(payload.referencePaths) ? payload.referencePaths : [])
    .map((value) => String(value || ''))
    .filter(Boolean)
    .slice(0, 30)

  if (!trendId) return NextResponse.json({ error: 'TREND_ID_REQUIRED' }, { status: 400 })
  if (referencePaths.some((path) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }

  const trendResponse = await supabaseFetch(
    `trends?select=id,title_en,title_ru,token_cost,provider,model,published,hidden_prompt,input_schema,duration_seconds,aspect_ratio,generation_config&id=eq.${encodeURIComponent(trendId)}&limit=1`,
  )
  const trends = trendResponse.ok ? await trendResponse.json() : []
  const trend = trends?.[0]

  if (!trend?.published) return NextResponse.json({ error: 'Trend not found' }, { status: 404 })
  if (String(trend.provider || '').toLowerCase() !== 'apimodels' || String(trend.model || '').toLowerCase() !== MODEL) {
    return NextResponse.json({ error: 'DIRECT_TREND_PROVIDER_NOT_SUPPORTED' }, { status: 400 })
  }

  const config = trend.generation_config && typeof trend.generation_config === 'object'
    ? trend.generation_config as Record<string, unknown>
    : {}
  if (String(config.execution_mode || '') !== 'direct') {
    return NextResponse.json({ error: 'DIRECT_TREND_MODE_NOT_ENABLED' }, { status: 400 })
  }

  const sourceVideoPath = String(config.source_video_path || '')
  if (!sourceVideoPath) return NextResponse.json({ error: 'TREND_SOURCE_VIDEO_MISSING' }, { status: 500 })

  const inputSchema = Array.isArray(trend.input_schema) ? trend.input_schema : []
  const expectedImageCount = inputSchema.filter((item: any) => String(item?.kind || 'photo') === 'photo' && item?.required !== false).length
  if (referencePaths.length !== expectedImageCount) {
    return NextResponse.json({ error: 'REFERENCE_COUNT_MISMATCH', expected: expectedImageCount, received: referencePaths.length }, { status: 400 })
  }

  const rawPrompt = String(trend.hidden_prompt || '').trim()
  const prompt = canonicalizeTags(rawPrompt)
  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 500 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 500 })

  const duration = Math.max(4, Math.min(30, Math.round(Number(trend.duration_seconds || 12))))
  const ratio = String(trend.aspect_ratio || '9:16')
  const tokenCost = Math.max(0, Number(trend.token_cost || 0))
  let newBalance: number | null = null

  if (tokenCost > 0) {
    const reserve = await rpc('reserve_tokens', {
      p_telegram_id: user.id,
      p_amount: tokenCost,
      p_reference: `trend:${trend.id}`,
    })
    if (!reserve.ok) {
      const details = await reserve.text()
      const insufficient = details.includes('INSUFFICIENT_TOKENS')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_TOKENS' : details }, { status: insufficient ? 402 : 500 })
    }
    newBalance = Number(await reserve.json())
  }

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'trend',
      source_id: trend.id,
      title: trend.title_ru || trend.title_en,
      status: 'queued',
      token_cost: tokenCost,
      provider: 'apimodels',
      model: MODEL,
      input_payload: {
        mode: 'generate',
        prompt,
        source_video_path: sourceVideoPath,
        reference_paths: referencePaths,
        reference_count: referencePaths.length + 1,
        reference_tags: [
          '@Video1',
          ...referencePaths.map((_, index) => `@Image${index + 1}`),
        ],
        generate_audio: generateAudio,
        duration,
        aspect_ratio: ratio,
        resolution,
        execution_mode: 'direct',
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    if (tokenCost > 0) {
      await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `history-failed:${trend.id}`,
      })
    }
    const details = await historyResponse.text().catch(() => '')
    return NextResponse.json({ error: 'Could not create generation job', details: details.slice(0, 500) }, { status: 500 })
  }

  const job = (await historyResponse.json())?.[0]

  try {
    const signedReferences = await Promise.all(
      referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )

    if (!signedReferences[0]) throw new Error('PERSON_REFERENCE_MISSING')
    const portrait = await registerApiModelsPortrait(signedReferences[0], `trend-${trend.id}-person`)
    const references = [
      portrait.assetUrl,
      ...signedReferences.slice(1),
    ]

    const videoUrl = await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)
    const callbackToken = createApiModelsCallbackToken(job.id)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(job.id)}&token=${encodeURIComponent(callbackToken)}`

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        input_payload: {
          mode: 'generate',
          prompt,
          source_video_path: sourceVideoPath,
          reference_paths: referencePaths,
          reference_count: referencePaths.length + 1,
          reference_tags: [
            '@Video1',
            ...referencePaths.map((_, index) => `@Image${index + 1}`),
          ],
          generate_audio: generateAudio,
          duration,
          aspect_ratio: ratio,
          resolution,
          execution_mode: 'direct',
          person_reference_mode: 'asset',
          person_asset_id: portrait.id || null,
          person_asset_url: portrait.assetUrl,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    const task = await createApiModelsSeedance25Task({
      promptText: prompt,
      duration,
      ratio,
      references,
      videoReferences: [videoUrl],
      resolution,
      generateAudio,
      callbackUrl,
    })

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'processing',
        processing_at: new Date().toISOString(),
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_direct_tool: true,
          apimodels_trend_direct: true,
          apimodels_mode: 'generate',
          apimodels_resolution: resolution,
          apimodels_person_asset: true,
          prompt_version: String(config.prompt_version || 'control'),
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId: job.id,
      providerTaskId: task.id,
      tokenBalance: newBalance,
    })
  } catch (error) {
    if (tokenCost > 0) {
      const refund = await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `apimodels-direct-failed:${job.id}`,
      })
      if (refund.ok) newBalance = Number(await refund.json())
    }

    const message = error instanceof Error ? error.message : 'APIMODELS_CREATE_FAILED'
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: message.slice(0, 240),
        failed_at: new Date().toISOString(),
        refunded_at: tokenCost > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      error: 'APIMODELS_CREATE_FAILED',
      details: message,
      tokenBalance: newBalance,
    }, { status: 502 })
  }
}
