import { NextResponse } from 'next/server'
import {
  createApiModelsSeedance25EditTask,
  createApiModelsSeedance25Task,
  type ApiModelsResolution,
} from '@/lib/server/apimodels'
import {
  createStorageSignedDownloadUrl,
  hasDatabase,
  supabaseFetch,
} from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MODEL = 'seedance-2.5'
const INPUT_BUCKET = 'generation-inputs'

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
  const mode = String(payload.mode || 'generate') === 'edit' ? 'edit' : 'generate'
  const rawPrompt = String(payload.prompt || '').trim()
  const prompt = canonicalizeTags(rawPrompt)
  const generateAudio = payload.generateAudio !== false
  const duration = clampDuration(payload.duration)
  const resolution = safeResolution(payload.resolution)
  const sourceVideoPath = String(payload.sourceVideoPath || '')
  const rawReferencePaths = Array.isArray(payload.referencePaths) ? payload.referencePaths : []
  const referencePaths = rawReferencePaths
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

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'tool',
      source_id: mode === 'edit' ? 'seedance2-5-video-edit' : sourceVideoPath ? 'seedance2-5-reference-video' : 'seedance2-5-direct',
      title: mode === 'edit' ? 'Seedance 2.5 · Video Edit' : sourceVideoPath ? 'Seedance 2.5 · Video reference' : 'Seedance 2.5',
      status: 'queued',
      token_cost: 0,
      provider: 'apimodels',
      model: MODEL,
      input_payload: {
        mode,
        prompt,
        source_video_path: sourceVideoPath || null,
        reference_paths: referencePaths,
        reference_count: referencePaths.length + (sourceVideoPath ? 1 : 0),
        reference_tags: [
          ...(sourceVideoPath ? ['@Video1'] : []),
          ...referencePaths.map((_, index) => `@Image${index + 1}`),
        ],
        generate_audio: generateAudio,
        duration: mode === 'edit' ? -1 : duration,
        aspect_ratio: mode === 'edit' ? 'adaptive' : '9:16',
        resolution,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    const details = await historyResponse.text().catch(() => '')
    return NextResponse.json({ error: 'Could not create generation job', details: details.slice(0, 500) }, { status: 500 })
  }
  const job = (await historyResponse.json())?.[0]

  try {
    const references = await Promise.all(
      referencePaths.map((path) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const videoReferences = sourceVideoPath
      ? [await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)]
      : []

    const task = mode === 'edit'
      ? await createApiModelsSeedance25EditTask({
          promptText: prompt,
          videoUrl: videoReferences[0],
          references,
          resolution,
          generateAudio,
        })
      : await createApiModelsSeedance25Task({
          promptText: prompt,
          duration,
          ratio: '9:16',
          references,
          videoReferences,
          resolution,
          generateAudio,
        })

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'processing',
        processing_at: new Date().toISOString(),
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_direct_tool: true,
          apimodels_mode: mode,
          apimodels_resolution: resolution,
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
    const message = error instanceof Error ? error.message : 'APIMODELS_CREATE_FAILED'
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: message.slice(0, 240),
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      error: 'APIMODELS_CREATE_FAILED',
      details: message,
    }, { status: 502 })
  }
}
