import { NextResponse } from 'next/server'
import { createApiModelsSeedance25Task, type ApiModelsResolution, createApiModelsCallbackToken } from '@/lib/server/apimodels'
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

async function getOriginalJob(userId: number, jobId: string) {
  const response = await supabaseFetch(
    `generation_history?select=id,title,status,provider,model,input_payload,created_at&id=eq.${encodeURIComponent(jobId)}&telegram_id=eq.${userId}&limit=1`,
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
  const referencePaths = (Array.isArray(input.reference_paths) ? input.reference_paths : [])
    .map((value) => String(value || ''))
    .filter(Boolean)
    .slice(0, 30)

  if (prompt.length < 5 || prompt.length > 12_000) throw new Error('REPEAT_PROMPT_INVALID')
  if (!sourceVideoPath.startsWith(`${userId}/videos/`)) throw new Error('REPEAT_SOURCE_VIDEO_INVALID')
  if (referencePaths.length === 0 || referencePaths.some((path) => !path.startsWith(`${userId}/images/`))) {
    throw new Error('REPEAT_REFERENCE_PATH_INVALID')
  }

  return {
    prompt,
    sourceVideoPath,
    referencePaths,
    duration: safeDuration(input.duration),
    resolution: safeResolution(input.resolution),
    ratio: String(input.aspect_ratio || '9:16'),
    generateAudio: input.generate_audio !== false,
    referenceTags: Array.isArray(input.reference_tags)
      ? input.reference_tags.map((value) => String(value || '')).filter(Boolean)
      : [
          '@Video1',
          ...referencePaths.map((_, index) => `@Image${index + 1}`),
        ],
  }
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

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

    let sourceVideoUrl = ''
    let referenceUrls: string[] = []
    if (!inputsExpired) {
      ;[sourceVideoUrl, referenceUrls] = await Promise.all([
        createStorageSignedDownloadUrl(INPUT_BUCKET, config.sourceVideoPath, 7200),
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
        sourceVideo: {
          path: inputsExpired ? '' : config.sourceVideoPath,
          url: sourceVideoUrl,
          label: '@Video1',
        },
        references: config.referencePaths.map((path, index) => ({
          path: inputsExpired ? '' : path,
          url: referenceUrls[index] || '',
          label: `@Image${index + 1}`,
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

  const sourceVideoPath = typeof payload.sourceVideoPath === 'string' && payload.sourceVideoPath.trim()
    ? payload.sourceVideoPath.trim()
    : inputsExpired ? '' : original.sourceVideoPath
  const referencePaths = (Array.isArray(payload.referencePaths) ? payload.referencePaths : inputsExpired ? [] : original.referencePaths)
    .map((value) => String(value || ''))
    .filter(Boolean)
    .slice(0, 30)

  if (!sourceVideoPath || !sourceVideoPath.startsWith(`${user.id}/videos/`)) {
    return NextResponse.json({ error: inputsExpired ? 'SOURCE_VIDEO_REUPLOAD_REQUIRED' : 'INVALID_SOURCE_VIDEO_PATH' }, { status: 400 })
  }
  if (referencePaths.length !== original.referencePaths.length) {
    return NextResponse.json({ error: inputsExpired ? 'REFERENCES_REUPLOAD_REQUIRED' : 'REFERENCE_COUNT_MISMATCH' }, { status: 400 })
  }
  if (referencePaths.some((path) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'tool',
      source_id: 'seedance2-5-repeat',
      title: `Repeat · ${String(row.title || 'Seedance 2.5')}`,
      status: 'queued',
      token_cost: 0,
      provider: 'apimodels',
      model: MODEL,
      input_payload: {
        mode: 'generate',
        prompt,
        source_video_path: sourceVideoPath,
        reference_paths: referencePaths,
        reference_count: referencePaths.length + 1,
        reference_tags: original.referenceTags,
        generate_audio: original.generateAudio,
        duration: original.duration,
        aspect_ratio: original.ratio,
        resolution: original.resolution,
        repeated_from_job_id: jobId,
        repeat_exact_config: true,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    const details = await historyResponse.text().catch(() => '')
    return NextResponse.json({ error: 'Could not create repeat job', details: details.slice(0, 500) }, { status: 500 })
  }
  const job = (await historyResponse.json())?.[0]

  try {
    const [references, videoUrl] = await Promise.all([
      Promise.all(referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200))),
      createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200),
    ])
    const callbackToken = createApiModelsCallbackToken(job.id)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(job.id)}&token=${encodeURIComponent(callbackToken)}`

    const task = await createApiModelsSeedance25Task({
      promptText: prompt,
      duration: original.duration,
      ratio: original.ratio,
      references,
      videoReferences: [videoUrl],
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
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId: job.id,
      providerTaskId: task.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APIMODELS_REPEAT_CREATE_FAILED'
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: message.slice(0, 240),
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })
    return NextResponse.json({ error: 'APIMODELS_REPEAT_CREATE_FAILED', details: message }, { status: 502 })
  }
}
