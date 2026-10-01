import { NextResponse } from 'next/server'
import {
  createApiModelsCallbackToken,
  createApiModelsSeedance25EditTask,
  createApiModelsSeedance25Task,
  type ApiModelsResolution,
} from '@/lib/server/apimodels'
import { quoteTokens } from '@/lib/server/model-pricing'
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

function clampDuration(value: unknown) {
  const parsed = Math.round(Number(value || 12))
  return Math.max(4, Math.min(30, Number.isFinite(parsed) ? parsed : 12))
}

function safeResolution(value: unknown): ApiModelsResolution {
  const v = String(value || '480p')
  if (v === '720p') return '720p'
  return '480p'
}

function canonicalizeTags(prompt: string) {
  return prompt
    .replace(/@video\s*(\d+)/gi, '@video$1')
    .replace(/@image\s*(\d+)/gi, '@image$1')
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON_BODY_REQUIRED' }, { status: 415 })

  const payload = body as Record<string, unknown>
  const mode = String(payload.mode || 'generate') === 'edit' ? 'edit' : 'generate'
  const prompt = canonicalizeTags(String(payload.prompt || '').trim())
  const generateAudio = payload.generateAudio !== false
  const duration = clampDuration(payload.duration)
  const sourceDuration = Math.max(4, Math.min(30, Number(payload.sourceDuration || duration)))
  const resolution = safeResolution(payload.resolution)
  const sourceVideoPath = String(payload.sourceVideoPath || '')
  const referencePaths = (Array.isArray(payload.referencePaths) ? payload.referencePaths : [])
    .map((value) => String(value || ''))
    .filter(Boolean)
    .slice(0, 30)

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })
  if (mode === 'edit' && !sourceVideoPath.startsWith(`${user.id}/videos/`)) {
    return NextResponse.json({ error: 'SOURCE_VIDEO_REQUIRED' }, { status: 400 })
  }
  if (sourceVideoPath && !sourceVideoPath.startsWith(`${user.id}/videos/`)) {
    return NextResponse.json({ error: 'INVALID_VIDEO_REFERENCE_PATH' }, { status: 400 })
  }
  if (referencePaths.some((path) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }

  // Editing has input-token billing upstream, so reserve a conservative 20% buffer.
  const quote = await quoteTokens({
    toolId: 'seedance-2-5',
    duration: mode === 'edit' ? sourceDuration : duration,
    resolution,
    generateAudio,
  })
  const tokenCost = mode === 'edit' ? Math.ceil((quote.tokenCost * 1.2) / 10) * 10 : quote.tokenCost

  const createResponse = await rpc('create_generation', {
    p_telegram_id: user.id,
    p_type: 'tool',
    p_source_id: mode === 'edit' ? 'seedance2-5-video-edit' : sourceVideoPath ? 'seedance2-5-reference-video' : 'seedance2-5-direct',
    p_title: mode === 'edit' ? 'Seedance 2.5 · Video Edit' : sourceVideoPath ? 'Seedance 2.5 · Video reference' : 'Seedance 2.5',
    p_token_cost: tokenCost,
    p_provider: 'apimodels',
    p_model: MODEL,
    p_input_payload: {
      mode,
      prompt,
      source_video_path: sourceVideoPath || null,
      reference_paths: referencePaths,
      reference_count: referencePaths.length + (sourceVideoPath ? 1 : 0),
      reference_tags: [
        ...(sourceVideoPath ? ['@video1'] : []),
        ...referencePaths.map((_, index) => `@image${index + 1}`),
      ],
      generate_audio: generateAudio,
      duration: mode === 'edit' ? -1 : duration,
      source_duration: mode === 'edit' ? sourceDuration : null,
      aspect_ratio: mode === 'edit' ? 'adaptive' : '9:16',
      resolution,
      quoted_provider_usd: quote.providerUsd,
      quoted_usd_rub: quote.usdRub,
    },
  })

  if (!createResponse.ok) {
    const details = await createResponse.text()
    if (details.includes('INSUFFICIENT_TOKENS')) {
      return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', requiredTokens: tokenCost }, { status: 402 })
    }
    return NextResponse.json({ error: 'Could not create generation job' }, { status: 500 })
  }

  const jobId = String(await createResponse.json()).replace(/^"|"$/g, '')

  try {
    const references = await Promise.all(
      referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const videoReferences = sourceVideoPath
      ? [await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)]
      : []
    const callbackToken = createApiModelsCallbackToken(jobId)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(callbackToken)}`

    const task = mode === 'edit'
      ? await createApiModelsSeedance25EditTask({
          promptText: prompt,
          videoUrl: videoReferences[0],
          references,
          resolution,
          generateAudio,
          callbackUrl,
        })
      : await createApiModelsSeedance25Task({
          promptText: prompt,
          duration,
          ratio: '9:16',
          references,
          videoReferences,
          resolution,
          generateAudio,
          callbackUrl,
        })

    await rpc('mark_generation_processing', { p_generation_id: jobId })
    await supabaseFetch(`generation_history?id=eq.${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_kind: 'video',
          apimodels_direct_tool: true,
          apimodels_mode: mode,
          apimodels_resolution: resolution,
          quoted_provider_usd: quote.providerUsd,
          quoted_usd_rub: quote.usdRub,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId,
      providerTaskId: task.id,
      tokenCost,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APIMODELS_CREATE_FAILED'
    await rpc('fail_generation', {
      p_generation_id: jobId,
      p_error_code: message.slice(0, 240),
      p_refund: true,
    })
    return NextResponse.json({ error: 'APIMODELS_CREATE_FAILED', details: message }, { status: 502 })
  }
}
