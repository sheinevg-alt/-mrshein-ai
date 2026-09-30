import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import { createBytePlusSeedance25Task } from '@/lib/server/byteplus'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MAX_INLINE_IMAGE_BYTES = 3_500_000
const DIRECT_TOKEN_COST = 40
const MODEL = 'dreamina-seedance-2-5-260628'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

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

function safeResolution(value: unknown): '480p' | '720p' {
  return String(value || '480p') === '720p' ? '720p' : '480p'
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
  const prompt = String(form.get('prompt') || '').trim()
  const generateAudio = String(form.get('generateAudio') ?? 'true') !== 'false'
  const duration = clampDuration(form.get('duration'))
  const resolution = safeResolution(form.get('resolution'))

  if (prompt.length < 5) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })

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

  const reserve = await rpc('reserve_tokens', {
    p_telegram_id: user.id,
    p_amount: DIRECT_TOKEN_COST,
    p_reference: 'tool:seedance2-5-direct',
  })
  if (!reserve.ok) {
    const text = await reserve.text()
    const insufficient = text.includes('INSUFFICIENT_TOKENS')
    return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_TOKENS' : text }, { status: insufficient ? 402 : 500 })
  }
  let newBalance = Number(await reserve.json())

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'tool',
      source_id: 'seedance2-5-direct',
      title: 'Seedance 2.5',
      status: 'queued',
      token_cost: DIRECT_TOKEN_COST,
      provider: 'byteplus',
      model: MODEL,
      input_payload: {
        prompt,
        reference_count: references.length,
        reference_tags: references.map((_, index) => `@Image${index + 1}`),
        generate_audio: generateAudio,
        duration,
        aspect_ratio: '9:16',
        resolution,
      },
      queued_at: new Date().toISOString(),
    }),
  })

  if (!historyResponse.ok) {
    const refund = await rpc('refund_tokens', {
      p_telegram_id: user.id,
      p_amount: DIRECT_TOKEN_COST,
      p_reference: 'history-failed:seedance2-5-direct',
    })
    if (refund.ok) newBalance = Number(await refund.json())
    return NextResponse.json({ error: 'Could not create generation job', tokenBalance: newBalance }, { status: 500 })
  }

  const job = (await historyResponse.json())?.[0]

  try {
    const task = await createBytePlusSeedance25Task({
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
      tokenBalance: newBalance,
    })
  } catch (error) {
    const refund = await rpc('refund_tokens', {
      p_telegram_id: user.id,
      p_amount: DIRECT_TOKEN_COST,
      p_reference: `byteplus-create-failed:${job.id}`,
    })
    if (refund.ok) newBalance = Number(await refund.json())

    const message = error instanceof Error ? error.message : 'BYTEPLUS_CREATE_FAILED'
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        error_code: message.slice(0, 240),
        failed_at: new Date().toISOString(),
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      error: 'BYTEPLUS_CREATE_FAILED',
      details: message,
      tokensRefunded: DIRECT_TOKEN_COST,
      tokenBalance: newBalance,
    }, { status: 502 })
  }
}
