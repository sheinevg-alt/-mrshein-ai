import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import {
  createApiModelsSeedance25Task,
  type ApiModelsResolution,
  createApiModelsCallbackToken,
  registerApiModelsPortrait,
} from '@/lib/server/apimodels'
import { createStorageSignedDownloadUrl, hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MODEL = 'seedance-2.5'
const INPUT_BUCKET = 'generation-inputs'
const INPUT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000

function safeResolution(value: unknown): ApiModelsResolution {
  return String(value || '480p') === '720p' ? '720p' : '480p'
}

function safeDuration(value: unknown) {
  const parsed = Math.round(Number(value || 12))
  return Math.max(4, Math.min(30, Number.isFinite(parsed) ? parsed : 12))
}

function cleanPaths(value: unknown, max = 30) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || ''))
    .filter(Boolean)
    .slice(0, max)
}

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

async function getOriginalJob(userId: number, jobId: string) {
  const response = await supabaseFetch(
    `generation_history?select=id,type,source_id,title,status,provider,model,token_cost,input_payload,created_at&id=eq.${encodeURIComponent(jobId)}&telegram_id=eq.${userId}&limit=1`,
  )
  const rows = response.ok ? await response.json() : []
  return rows?.[0] || null
}

function normalizePayload(row: any, userId: number) {
  const input = row?.input_payload && typeof row.input_payload === 'object'
    ? row.input_payload as Record<string, unknown>
    : {}

  const mode = String(input.mode || 'generate')
  if (mode !== 'generate') throw new Error('REPEAT_ONLY_GENERATE_SUPPORTED')

  const prompt = String(input.prompt || '').trim()
  const sourceVideoPath = String(input.source_video_path || '')
  const sourceVideoUrl = String(input.source_video_url || '')
  const modernImagePaths = cleanPaths(input.reference_image_paths, 30)
  const legacyImagePaths = cleanPaths(input.reference_paths, 30)
  const referencePaths = modernImagePaths.length ? modernImagePaths : legacyImagePaths
  const extraVideoPaths = cleanPaths(input.reference_video_paths, 10)
  const audioPaths = cleanPaths(input.reference_audio_paths, 10)

  if (prompt.length < 5 || prompt.length > 12_000) throw new Error('REPEAT_PROMPT_INVALID')
  if (sourceVideoPath && !sourceVideoPath.startsWith(`${userId}/videos/`)) throw new Error('REPEAT_SOURCE_VIDEO_INVALID')
  if (sourceVideoUrl && !sourceVideoUrl.startsWith('https://')) throw new Error('REPEAT_SOURCE_VIDEO_INVALID')
  if (referencePaths.length === 0 || referencePaths.some((path) => !path.startsWith(`${userId}/images/`))) {
    throw new Error('REPEAT_REFERENCE_PATH_INVALID')
  }
  if (extraVideoPaths.some((path) => !path.startsWith(`${userId}/videos/`))) {
    throw new Error('REPEAT_VIDEO_REFERENCE_PATH_INVALID')
  }
  if (audioPaths.some((path) => !path.startsWith(`${userId}/audios/`))) {
    throw new Error('REPEAT_AUDIO_REFERENCE_PATH_INVALID')
  }

  const hasLegacySource = Boolean(sourceVideoPath || sourceVideoUrl)
  const defaultTags = [
    ...referencePaths.map((_, index) => `@image${index + 1}`),
    ...(hasLegacySource ? ['@video1'] : extraVideoPaths.map((_, index) => `@video${index + 1}`)),
    ...audioPaths.map((_, index) => `@audio${index + 1}`),
  ]

  return {
    prompt,
    sourceVideoPath,
    sourceVideoUrl,
    referencePaths,
    extraVideoPaths,
    audioPaths,
    duration: safeDuration(input.duration),
    resolution: safeResolution(input.resolution),
    ratio: String(input.aspect_ratio || '9:16'),
    generateAudio: input.generate_audio !== false,
    personReferenceMode: String(input.person_reference_mode || ''),
    referenceTags: Array.isArray(input.reference_tags)
      ? input.reference_tags.map((value) => String(value || '')).filter(Boolean)
      : defaultTags,
  }
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const jobId = new URL(request.url).searchParams.get('jobId') || ''
  if (!jobId) return NextResponse.json({ error: 'JOB_ID_REQUIRED' }, { status: 400 })

  const row = await getOriginalJob(user.id, jobId)
  if (!row || row.status !== 'completed') return NextResponse.json({ error: 'REPEAT_SOURCE_NOT_FOUND' }, { status: 404 })
  if (String(row.provider || '').toLowerCase() !== 'apimodels' || String(row.model || '').toLowerCase() !== MODEL) {
    return NextResponse.json({ error: 'REPEAT_PROVIDER_NOT_SUPPORTED' }, { status: 400 })
  }

  try {
    const config = normalizePayload(row, user.id)
    const createdAt = new Date(String(row.created_at || '')).getTime()
    const inputsExpired = !Number.isFinite(createdAt) || Date.now() - createdAt >= INPUT_RETENTION_MS

    let sourceVideoUrl = config.sourceVideoUrl
    let referenceUrls: string[] = []

    if (!inputsExpired) {
      const signedSourcePromise = config.sourceVideoPath
        ? createStorageSignedDownloadUrl(INPUT_BUCKET, config.sourceVideoPath, 7200)
        : Promise.resolve(config.sourceVideoUrl)

      ;[sourceVideoUrl, referenceUrls] = await Promise.all([
        signedSourcePromise,
        Promise.all(config.referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200))),
      ])
    }

    return NextResponse.json({
      ok: true,
      template: {
        jobId: String(row.id),
        title: String(row.title || 'Seedance 2.5'),
        prompt: config.prompt,
        duration: config.duration,
        resolution: config.resolution,
        aspectRatio: config.ratio,
        generateAudio: config.generateAudio,
        referenceTags: config.referenceTags,
        inputsExpired,
        inputRetentionDays: 3,
        sourceVideo: (config.sourceVideoPath || config.sourceVideoUrl)
          ? {
              path: inputsExpired ? '' : config.sourceVideoPath,
              url: config.sourceVideoUrl || (inputsExpired ? '' : sourceVideoUrl),
              label: '@video1',
              persistent: Boolean(config.sourceVideoUrl),
            }
          : null,
        references: config.referencePaths.map((path, index) => ({
          path: inputsExpired ? '' : path,
          url: referenceUrls[index] || '',
          label: `@image${index + 1}`,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'REPEAT_TEMPLATE_FAILED',
    }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON_BODY_REQUIRED' }, { status: 415 })

  const payload = body as Record<string, unknown>
  const jobId = String(payload.jobId || '')
  if (!jobId) return NextResponse.json({ error: 'JOB_ID_REQUIRED' }, { status: 400 })

  const row = await getOriginalJob(user.id, jobId)
  if (!row || row.status !== 'completed') return NextResponse.json({ error: 'REPEAT_SOURCE_NOT_FOUND' }, { status: 404 })
  if (String(row.provider || '').toLowerCase() !== 'apimodels' || String(row.model || '').toLowerCase() !== MODEL) {
    return NextResponse.json({ error: 'REPEAT_PROVIDER_NOT_SUPPORTED' }, { status: 400 })
  }

  let original
  try {
    original = normalizePayload(row, user.id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'REPEAT_SOURCE_INVALID' }, { status: 400 })
  }

  const createdAt = new Date(String(row.created_at || '')).getTime()
  const inputsExpired = !Number.isFinite(createdAt) || Date.now() - createdAt >= INPUT_RETENTION_MS

  const prompt = typeof payload.prompt === 'string' && payload.prompt.trim()
    ? payload.prompt.trim()
    : original.prompt

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })

  const replacementSourceVideoPath = typeof payload.sourceVideoPath === 'string'
    ? payload.sourceVideoPath.trim()
    : ''
  const sourceVideoPath = replacementSourceVideoPath || (inputsExpired ? '' : original.sourceVideoPath)
  const sourceVideoUrl = replacementSourceVideoPath ? '' : original.sourceVideoUrl

  const referencePaths = (Array.isArray(payload.referencePaths) ? payload.referencePaths : inputsExpired ? [] : original.referencePaths)
    .map((value) => String(value || ''))
    .filter(Boolean)
    .slice(0, 30)

  if (sourceVideoPath && !sourceVideoPath.startsWith(`${user.id}/videos/`)) {
    return NextResponse.json({ error: 'INVALID_SOURCE_VIDEO_PATH' }, { status: 400 })
  }
  if (!sourceVideoPath && !sourceVideoUrl && (original.sourceVideoPath || original.sourceVideoUrl)) {
    return NextResponse.json({ error: 'SOURCE_VIDEO_REUPLOAD_REQUIRED' }, { status: 400 })
  }
  if (referencePaths.length !== original.referencePaths.length) {
    return NextResponse.json({ error: inputsExpired ? 'REFERENCES_REUPLOAD_REQUIRED' : 'REFERENCE_COUNT_MISMATCH' }, { status: 400 })
  }
  if (referencePaths.some((path) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }

  const tokenCost = Math.max(0, Number(row.token_cost || 0))
  const repeatRequestId = randomUUID()
  if (tokenCost > 0) {
    const reserve = await rpc('reserve_tokens', {
      p_telegram_id: user.id,
      p_amount: tokenCost,
      p_reference: `repeat:${jobId}:${repeatRequestId}`,
    })
    if (!reserve.ok) {
      const details = await reserve.text()
      const insufficient = details.includes('INSUFFICIENT_TOKENS')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_TOKENS' : 'TOKEN_RESERVE_FAILED' }, { status: insufficient ? 402 : 500 })
    }
  }

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: row.type || 'tool',
      source_id: row.source_id || 'seedance2-5-repeat',
      title: `Repeat · ${String(row.title || 'Seedance 2.5')}`,
      status: 'queued',
      token_cost: tokenCost,
      provider: 'apimodels',
      model: MODEL,
      input_payload: {
        mode: 'generate',
        prompt,
        source_video_path: sourceVideoPath || null,
        source_video_url: sourceVideoUrl || null,
        reference_paths: referencePaths,
        reference_video_paths: original.extraVideoPaths,
        reference_audio_paths: original.audioPaths,
        reference_count: referencePaths.length + original.extraVideoPaths.length + original.audioPaths.length + (sourceVideoPath || sourceVideoUrl ? 1 : 0),
        reference_tags: original.referenceTags,
        generate_audio: original.generateAudio,
        duration: original.duration,
        aspect_ratio: original.ratio,
        resolution: original.resolution,
        repeated_from_job_id: jobId,
        repeat_exact_config: true,
        person_reference_mode: original.personReferenceMode || null,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    if (tokenCost > 0) {
      await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `repeat-history-failed:${repeatRequestId}`,
      })
    }
    const details = await historyResponse.text().catch(() => '')
    return NextResponse.json({ error: 'Could not create repeat job', details: details.slice(0, 500) }, { status: 500 })
  }
  const job = (await historyResponse.json())?.[0]

  try {
    const [signedImages, signedExtraVideos, signedAudios, legacyVideoUrl] = await Promise.all([
      Promise.all(referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200))),
      Promise.all(original.extraVideoPaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200))),
      Promise.all(original.audioPaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200))),
      sourceVideoUrl
        ? Promise.resolve(sourceVideoUrl)
        : sourceVideoPath
          ? createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)
          : Promise.resolve(''),
    ])

    let references = signedImages
    let personAssetId = ''
    if (original.personReferenceMode === 'asset' && signedImages[0]) {
      const portrait = await registerApiModelsPortrait(signedImages[0], `repeat-${job.id}-person`)
      personAssetId = portrait.id
      references = [portrait.assetUrl, ...signedImages.slice(1)]
    }

    const videoReferences = legacyVideoUrl
      ? [legacyVideoUrl, ...signedExtraVideos]
      : signedExtraVideos

    const callbackToken = createApiModelsCallbackToken(job.id)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(job.id)}&token=${encodeURIComponent(callbackToken)}`

    const task = await createApiModelsSeedance25Task({
      promptText: prompt,
      duration: original.duration,
      ratio: original.ratio,
      references,
      videoReferences,
      audioReferences: signedAudios,
      resolution: original.resolution,
      generateAudio: original.generateAudio,
      callbackUrl,
    })

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'processing',
        processing_at: new Date().toISOString(),
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_repeat_exact: true,
          repeated_from_job_id: jobId,
          apimodels_mode: 'generate',
          apimodels_resolution: original.resolution,
          apimodels_person_asset: original.personReferenceMode === 'asset',
          person_asset_id: personAssetId || null,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId: job.id,
      providerTaskId: task.id,
      tokenCost,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APIMODELS_REPEAT_CREATE_FAILED'
    if (tokenCost > 0) {
      await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `repeat-provider-failed:${job.id}`,
      })
    }
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
    return NextResponse.json({ error: 'APIMODELS_REPEAT_CREATE_FAILED', details: message }, { status: 502 })
  }
}
