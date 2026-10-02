import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import {
  createApiModelsSeedance25EditTask,
  createApiModelsSeedance25Task,
  type ApiModelsResolution,
  createApiModelsCallbackToken, } from '@/lib/server/apimodels'
import {
  createStorageSignedDownloadUrl,
  hasDatabase,
  supabaseFetch,
} from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const INPUT_BUCKET = 'generation-inputs'

function safeResolution(value: unknown): ApiModelsResolution {
  return String(value || '') === '720p' ? '720p' : '480p'
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const jobId = String(body?.jobId || '')
  if (!jobId) return NextResponse.json({ error: 'JOB_ID_REQUIRED' }, { status: 400 })

  const sourceResponse = await supabaseFetch(
    `generation_history?select=id,telegram_id,type,source_id,title,status,provider,model,input_payload&id=eq.${encodeURIComponent(jobId)}&telegram_id=eq.${user.id}&limit=1`,
  )
  const sourceRows = sourceResponse.ok ? await sourceResponse.json() : []
  const source = sourceRows?.[0]
  if (!source) return NextResponse.json({ error: 'GENERATION_NOT_FOUND' }, { status: 404 })
  if (source.status !== 'failed' || source.provider !== 'apimodels') {
    return NextResponse.json({ error: 'GENERATION_NOT_RETRYABLE' }, { status: 409 })
  }

  const input = source.input_payload || {}
  const mode = String(input.mode || 'generate') === 'edit' ? 'edit' : 'generate'
  const prompt = String(input.prompt || '').trim()
  const sourceVideoPath = String(input.source_video_path || '')
  const referencePaths = Array.isArray(input.reference_paths)
    ? input.reference_paths.map((value: unknown) => String(value || '')).filter(Boolean)
    : []
  const resolution = safeResolution(input.resolution)
  const generateAudio = input.generate_audio !== false
  const duration = Math.max(4, Math.min(30, Math.round(Number(input.duration || 12))))
  const aspectRatio = String(input.aspect_ratio || '9:16')

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_MISSING' }, { status: 409 })
  if (sourceVideoPath && !sourceVideoPath.startsWith(`${user.id}/videos/`)) {
    return NextResponse.json({ error: 'INVALID_VIDEO_REFERENCE_PATH' }, { status: 400 })
  }
  if (referencePaths.some((path: string) => !path.startsWith(`${user.id}/images/`))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: source.type || 'tool',
      source_id: source.source_id || 'seedance2-5-reference-video',
      title: source.title || 'Seedance 2.5',
      status: 'queued',
      token_cost: 0,
      provider: 'apimodels',
      model: source.model || 'seedance-2.5',
      input_payload: { ...input, retry_of: source.id },
      result_metadata: { retry_of: source.id },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    return NextResponse.json({ error: 'RETRY_JOB_CREATE_FAILED' }, { status: 500 })
  }
  const job = (await historyResponse.json())?.[0]

  try {
    const references = await Promise.all(
      referencePaths.map((path: string) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const videoReferences = sourceVideoPath
      ? [await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)]
      : []
    const callbackToken = createApiModelsCallbackToken(job.id)
    const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(job.id)}&token=${encodeURIComponent(callbackToken)}`

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
          ratio: aspectRatio,
          references,
          videoReferences,
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
          retry_of: source.id,
          apimodels_task_id: task.id,
          apimodels_direct_tool: true,
          apimodels_mode: mode,
          apimodels_resolution: resolution,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, providerTaskId: task.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'APIMODELS_RETRY_FAILED'
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: message.slice(0, 240),
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })
    return NextResponse.json({ error: 'APIMODELS_RETRY_FAILED' }, { status: 502 })
  }
}
