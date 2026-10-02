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
const MAX_IMAGES = 30
const MAX_VIDEOS = 10
const MAX_AUDIOS = 10
const MAX_REFERENCES = 50
const RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'adaptive'])

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

function clampDuration(value: unknown) {
  const parsed = Math.round(Number(value || 12))
  return Math.max(4, Math.min(30, Number.isFinite(parsed) ? parsed : 12))
}

function safeResolution(value: unknown): ApiModelsResolution {
  return String(value || '480p') === '720p' ? '720p' : '480p'
}

function safeRatio(value: unknown) {
  const ratio = String(value || '9:16')
  return RATIOS.has(ratio) ? ratio : '9:16'
}

function cleanPaths(value: unknown, max: number) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || ''))
    .filter(Boolean)
    .slice(0, max)
}

function canonicalizeTags(prompt: string) {
  return prompt
    .replace(/@video\s*(\d+)/gi, '@video$1')
    .replace(/@image\s*(\d+)/gi, '@image$1')
    .replace(/@audio\s*(\d+)/gi, '@audio$1')
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
  const ratio = mode === 'edit' ? 'adaptive' : safeRatio(payload.ratio)

  // New professional Omni Reference payload.
  // Keep referencePaths/sourceVideoPath compatibility for older clients.
  const legacyImages = cleanPaths(payload.referencePaths, MAX_IMAGES)
  const referenceImagePaths = cleanPaths(payload.referenceImagePaths, MAX_IMAGES)
  const referenceVideoPaths = cleanPaths(payload.referenceVideoPaths, MAX_VIDEOS)
  const referenceAudioPaths = cleanPaths(payload.referenceAudioPaths, MAX_AUDIOS)
  const sourceVideoPath = String(payload.sourceVideoPath || '')

  const imagePaths = referenceImagePaths.length ? referenceImagePaths : legacyImages
  const videoPaths = mode === 'generate'
    ? (referenceVideoPaths.length ? referenceVideoPaths : sourceVideoPath ? [sourceVideoPath] : [])
    : []
  const audioPaths = mode === 'generate' ? referenceAudioPaths : []

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })

  if (imagePaths.length > MAX_IMAGES || videoPaths.length > MAX_VIDEOS || audioPaths.length > MAX_AUDIOS) {
    return NextResponse.json({ error: 'REFERENCE_TYPE_LIMIT_EXCEEDED' }, { status: 400 })
  }
  if (imagePaths.length + videoPaths.length + audioPaths.length > MAX_REFERENCES) {
    return NextResponse.json({ error: 'REFERENCE_TOTAL_LIMIT_EXCEEDED' }, { status: 400 })
  }

  if (imagePaths.some((path) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_IMAGE_REFERENCE_PATH' }, { status: 400 })
  }
  if (videoPaths.some((path) => !path.startsWith(`${user.id}/videos/`))) {
    return NextResponse.json({ error: 'INVALID_VIDEO_REFERENCE_PATH' }, { status: 400 })
  }
  if (audioPaths.some((path) => !path.startsWith(`${user.id}/audios/`))) {
    return NextResponse.json({ error: 'INVALID_AUDIO_REFERENCE_PATH' }, { status: 400 })
  }

  if (mode === 'edit') {
    if (!sourceVideoPath.startsWith(`${user.id}/videos/`)) {
      return NextResponse.json({ error: 'SOURCE_VIDEO_REQUIRED' }, { status: 400 })
    }
    if (cleanPaths(payload.referenceVideoPaths, MAX_VIDEOS).length || cleanPaths(payload.referenceAudioPaths, MAX_AUDIOS).length) {
      return NextResponse.json({ error: 'EDIT_ACCEPTS_SOURCE_VIDEO_AND_IMAGE_REFERENCES' }, { status: 400 })
    }
  }

  const quote = await quoteTokens({
    toolId: 'seedance-2-5',
    duration: mode === 'edit' ? sourceDuration : duration,
    resolution,
    generateAudio,
  })
  const tokenCost = mode === 'edit' ? Math.ceil((quote.tokenCost * 1.2) / 10) * 10 : quote.tokenCost

  const referenceTags = mode === 'edit'
    ? [
        '@video1',
        ...imagePaths.map((_, index) => `@image${index + 1}`),
      ]
    : [
        ...imagePaths.map((_, index) => `@image${index + 1}`),
        ...videoPaths.map((_, index) => `@video${index + 1}`),
        ...audioPaths.map((_, index) => `@audio${index + 1}`),
      ]

  const createResponse = await rpc('create_generation', {
    p_telegram_id: user.id,
    p_type: 'tool',
    p_source_id: mode === 'edit' ? 'seedance2-5-video-edit' : 'seedance2-5-omni-reference',
    p_title: mode === 'edit' ? 'Seedance 2.5 · Video Edit' : 'Seedance 2.5 · Omni Reference',
    p_token_cost: tokenCost,
    p_provider: 'apimodels',
    p_model: MODEL,
    p_input_payload: {
      mode,
      prompt,
      source_video_path: mode === 'edit' ? sourceVideoPath : null,
      reference_image_paths: imagePaths,
      reference_video_paths: mode === 'generate' ? videoPaths : [],
      reference_audio_paths: mode === 'generate' ? audioPaths : [],
      reference_count: mode === 'edit'
        ? imagePaths.length + 1
        : imagePaths.length + videoPaths.length + audioPaths.length,
      reference_tags: referenceTags,
      generate_audio: generateAudio,
      duration: mode === 'edit' ? -1 : duration,
      source_duration: mode === 'edit' ? sourceDuration : null,
      aspect_ratio: ratio,
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
    const imageReferences = await Promise.all(
      imagePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const videoReferences = await Promise.all(
      (mode === 'generate' ? videoPaths : [sourceVideoPath])
        .filter(Boolean)
        .map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const audioReferences = await Promise.all(
      audioPaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )

    const callbackToken = createApiModelsCallbackToken(jobId)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(callbackToken)}`

    const task = mode === 'edit'
      ? await createApiModelsSeedance25EditTask({
          promptText: prompt,
          videoUrl: videoReferences[0],
          references: imageReferences,
          resolution,
          generateAudio,
          callbackUrl,
        })
      : await createApiModelsSeedance25Task({
          promptText: prompt,
          duration,
          ratio,
          references: imageReferences,
          videoReferences,
          audioReferences,
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
          apimodels_ratio: ratio,
          reference_count: mode === 'edit'
            ? imagePaths.length + 1
            : imagePaths.length + videoPaths.length + audioPaths.length,
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
