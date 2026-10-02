import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import {
  createApiModelsCallbackToken,
  createApiModelsImageUpscaleTask,
  createApiModelsVideoUpscaleTask,
} from '@/lib/server/apimodels'
import { quoteTokens } from '@/lib/server/model-pricing'
import { createStorageSignedDownloadUrl, hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const INPUT_BUCKET = 'generation-inputs'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const mediaType = String(body?.mediaType || '')
  if (mediaType !== 'video' && mediaType !== 'image') {
    return NextResponse.json({ error: 'INVALID_MEDIA_TYPE' }, { status: 400 })
  }

  const sourceJobId = String(body?.sourceJobId || '')
  const sourcePath = String(body?.sourcePath || '')
  let sourceUrl = ''
  let sourceDuration = Math.max(0, Number(body?.sourceDuration || 0))
  let sourceTitle = mediaType === 'video' ? 'Video' : 'Image'

  if (sourceJobId) {
    const response = await supabaseFetch(
      `generation_history?select=id,title,status,result_url,input_payload&telegram_id=eq.${user.id}&id=eq.${encodeURIComponent(sourceJobId)}&limit=1`,
    )
    const rows = response.ok ? await response.json() : []
    const source = rows?.[0]
    if (!source || source.status !== 'completed' || !source.result_url) {
      return NextResponse.json({ error: 'SOURCE_RESULT_NOT_READY' }, { status: 404 })
    }
    sourceUrl = String(source.result_url)
    sourceTitle = String(source.title || sourceTitle)
    if (!sourceDuration) sourceDuration = Number(source.input_payload?.duration || 0)
  } else if (sourcePath) {
    const folder = mediaType === 'video' ? 'videos' : 'images'
    const expectedPrefix = `${user.id}/${folder}/`
    if (!sourcePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'INVALID_SOURCE_PATH' }, { status: 400 })
    }
    sourceUrl = await createStorageSignedDownloadUrl(INPUT_BUCKET, sourcePath, 7200)
  }

  if (!sourceUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'SOURCE_REQUIRED' }, { status: 400 })
  }

  const targetResolution = String(body?.targetResolution || '1080p').toLowerCase()
  const scale = Number(body?.scale || 2) === 4 ? 4 : 2
  const faceEnhance = body?.faceEnhance === true

  if (mediaType === 'video') {
    if (!['720p', '1080p', '2k', '4k'].includes(targetResolution)) {
      return NextResponse.json({ error: 'INVALID_TARGET_RESOLUTION' }, { status: 400 })
    }
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 || sourceDuration > 120) {
      return NextResponse.json({ error: 'INVALID_SOURCE_DURATION' }, { status: 400 })
    }
  }

  const quote = await quoteTokens(
    mediaType === 'video'
      ? { toolId: 'video-upscale', duration: sourceDuration, resolution: targetResolution }
      : { toolId: 'image-upscale' },
  )
  const tokenCost = Math.max(0, Number(quote.tokenCost || 0))
  let tokenBalance: number | null = null

  if (tokenCost > 0) {
    const reserve = await rpc('reserve_tokens', {
      p_telegram_id: user.id,
      p_amount: tokenCost,
      p_reference: `upscale:${mediaType}:${sourceJobId || sourcePath}`,
    })
    if (!reserve.ok) {
      const text = await reserve.text()
      const insufficient = text.includes('INSUFFICIENT_TOKENS')
      return NextResponse.json(
        { error: insufficient ? 'INSUFFICIENT_TOKENS' : text, requiredTokens: tokenCost },
        { status: insufficient ? 402 : 500 },
      )
    }
    tokenBalance = Number(await reserve.json())
  }

  const model = mediaType === 'video' ? 'flashvsr' : 'real-esrgan'
  const title = mediaType === 'video' ? `${sourceTitle} · Upscale` : `${sourceTitle} · Upscale`
  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'tool',
      source_id: mediaType === 'video' ? 'video-upscale' : 'image-upscale',
      title,
      status: 'queued',
      token_cost: tokenCost,
      provider: 'apimodels',
      model,
      input_payload: {
        source_job_id: sourceJobId || null,
        source_path: sourcePath || null,
        source_duration: mediaType === 'video' ? sourceDuration : null,
        target_resolution: mediaType === 'video' ? targetResolution : null,
        scale: mediaType === 'image' ? scale : null,
        face_enhance: mediaType === 'image' ? faceEnhance : null,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    if (tokenCost > 0) await rpc('refund_tokens', {
      p_telegram_id: user.id,
      p_amount: tokenCost,
      p_reference: `upscale-history-failed:${sourceJobId || sourcePath}`,
    })
    return NextResponse.json({ error: 'Could not create upscale job' }, { status: 500 })
  }

  const job = (await historyResponse.json())?.[0]

  try {
    const callbackToken = createApiModelsCallbackToken(job.id)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(job.id)}&token=${encodeURIComponent(callbackToken)}`
    const task = mediaType === 'video'
      ? await createApiModelsVideoUpscaleTask({
          videoUrl: sourceUrl,
          resolution: targetResolution as '720p' | '1080p' | '2k' | '4k',
          callbackUrl,
        })
      : await createApiModelsImageUpscaleTask({
          imageUrl: sourceUrl,
          scale: scale as 2 | 4,
          faceEnhance,
          callbackUrl,
        })

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'processing',
        processing_at: new Date().toISOString(),
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_kind: mediaType,
          upscale: true,
          target_resolution: mediaType === 'video' ? targetResolution : null,
          scale: mediaType === 'image' ? scale : null,
          provider_cost_estimate_usd: quote.providerUsd,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId: job.id,
      tokenCost,
      tokenBalance,
      providerTaskId: task.id,
    })
  } catch (error) {
    if (tokenCost > 0) {
      const refund = await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `upscale-create-failed:${job.id}`,
      })
      if (refund.ok) tokenBalance = Number(await refund.json())
    }
    const message = error instanceof Error ? error.message : 'UPSCALE_CREATE_FAILED'
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
    return NextResponse.json(
      { error: 'UPSCALE_CREATE_FAILED', details: message, tokensRefunded: tokenCost, tokenBalance },
      { status: 502 },
    )
  }
}
