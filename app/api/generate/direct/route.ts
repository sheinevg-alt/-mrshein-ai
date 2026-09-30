import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import {
  createBytePlusSeedance25EditTask,
  createBytePlusSeedance25Task,
  type BytePlusResolution,
} from '@/lib/server/byteplus'
import {
  createStorageSignedDownloadUrl,
  hasDatabase,
  supabaseFetch,
} from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MAX_INLINE_IMAGE_BYTES = 3_500_000
const MODEL = 'dreamina-seedance-2-5-260628'
const INPUT_BUCKET = 'generation-inputs'

async function fileToDataUri(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('UNSUPPORTED_REFERENCE_TYPE')
  if (file.size > MAX_INLINE_IMAGE_BYTES) throw new Error('REFERENCE_IMAGE_TOO_LARGE')
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = (file.type || 'image/jpeg').toLowerCase()
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function clampDuration(value: unknown) {
  const parsed = Math.round(Number(value || 12))
  return Math.max(4, Math.min(30, Number.isFinite(parsed) ? parsed : 12))
}

function safeResolution(value: unknown): BytePlusResolution {
  const v = String(value || '480p')
  if (v === '1080p') return '1080p'
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

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 415 })
  }

  const form = await request.formData()
  const mode = String(form.get('mode') || 'generate') === 'edit' ? 'edit' : 'generate'
  const rawPrompt = String(form.get('prompt') || '').trim()
  const prompt = canonicalizeTags(rawPrompt)
  const generateAudio = String(form.get('generateAudio') ?? 'true') !== 'false'
  const duration = clampDuration(form.get('duration'))
  const resolution = safeResolution(form.get('resolution'))
  const sourceVideoPath = String(form.get('sourceVideoPath') || '')

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })
  if (mode === 'edit' && !sourceVideoPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'SOURCE_VIDEO_REQUIRED' }, { status: 400 })
  }

  const references: string[] = []
  try {
    for (let index = 1; index <= 3; index += 1) {
      const value = form.get(`reference${index}`)
      if (value instanceof File && value.size > 0) references.push(await fileToDataUri(value))
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_REFERENCE'
    const status = code === 'REFERENCE_IMAGE_TOO_LARGE' ? 413 : 400
    return NextResponse.json({ error: code }, { status })
  }

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'tool',
      source_id: mode === 'edit' ? 'seedance2-5-video-edit' : 'seedance2-5-direct',
      title: mode === 'edit' ? 'Seedance 2.5 · Video Edit' : 'Seedance 2.5',
      status: 'queued',
      token_cost: 0,
      provider: 'byteplus',
      model: MODEL,
      input_payload: {
        mode,
        prompt,
        source_video_path: mode === 'edit' ? sourceVideoPath : null,
        reference_count: references.length,
        reference_tags: references.map((_, index) => `@Image${index + 1}`),
        generate_audio: generateAudio,
        duration: mode === 'edit' ? -1 : duration,
        aspect_ratio: mode === 'edit' ? 'adaptive' : '9:16',
        resolution,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    return NextResponse.json({ error: 'Could not create generation job' }, { status: 500 })
  }
  const job = (await historyResponse.json())?.[0]

  try {
    const task = mode === 'edit'
      ? await createBytePlusSeedance25EditTask({
          promptText: prompt,
          videoUrl: await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200),
          references,
          resolution,
          generateAudio,
        })
      : await createBytePlusSeedance25Task({
          promptText: prompt,
          duration,
          ratio: '9:16',
          references,
          resolution,
          generateAudio,
        })

    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'processing',
        processing_at: new Date().toISOString(),
        result_metadata: {
          byteplus_task_id: task.id,
          byteplus_direct_tool: true,
          byteplus_mode: mode,
          byteplus_test_resolution: resolution,
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
    const message = error instanceof Error ? error.message : 'BYTEPLUS_CREATE_FAILED'
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
      error: 'BYTEPLUS_CREATE_FAILED',
      details: message,
    }, { status: 502 })
  }
}
