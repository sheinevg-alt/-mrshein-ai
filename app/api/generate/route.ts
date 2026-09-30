import { Buffer } from 'node:buffer'
import { NextResponse } from 'next/server'
import { createBytePlusSeedance25Task } from '@/lib/server/byteplus'
import { createSeedance25Task } from '@/lib/server/runway'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const MAX_INLINE_IMAGE_BYTES = 3_500_000

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

function ratioForRunway(aspectRatio?: string | null) {
  const ratio = String(aspectRatio || '9:16')
  const map: Record<string, string> = {
    '9:16': '720:1280',
    '16:9': '1280:720',
    '1:1': '960:960',
    '4:3': '1112:834',
    '3:4': '834:1112',
  }
  return map[ratio] || '720:1280'
}

function ratioForBytePlus(aspectRatio?: string | null) {
  const ratio = String(aspectRatio || '9:16')
  return ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].includes(ratio) ? ratio : '9:16'
}

async function fileToDataUri(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('UNSUPPORTED_REFERENCE_TYPE')
  if (file.size > MAX_INLINE_IMAGE_BYTES) throw new Error('REFERENCE_IMAGE_TOO_LARGE')
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = (file.type || 'image/jpeg').toLowerCase()
  return `data:${mime};base64,${bytes.toString('base64')}`
}

type InputSchemaItem = {
  id?: string
  kind?: string
  required?: boolean
  default_asset_url?: string
  tag?: string
}

async function readRequest(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    return {
      form,
      trendId: String(form.get('trendId') || ''),
      generateAudio: String(form.get('generateAudio') ?? 'true') !== 'false',
    }
  }
  const body = await request.json().catch(() => ({}))
  return {
    form: null as FormData | null,
    trendId: String(body?.trendId || ''),
    generateAudio: body?.generateAudio !== false,
  }
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { form, trendId, generateAudio } = await readRequest(request)
  if (!trendId) return NextResponse.json({ error: 'trendId is required' }, { status: 400 })

  const trendResponse = await supabaseFetch(
    `trends?select=id,title_en,title_ru,category,image_url,preview_video_url,token_cost,provider,model,published,hidden_prompt,input_schema,duration_seconds,aspect_ratio,generation_config&id=eq.${encodeURIComponent(trendId)}&limit=1`,
  )
  const trends = trendResponse.ok ? await trendResponse.json() : []
  const trend = trends?.[0]
  if (!trend?.published) return NextResponse.json({ error: 'Trend not found' }, { status: 404 })

  const inputSchema: InputSchemaItem[] = Array.isArray(trend.input_schema) ? trend.input_schema : []
  const references: string[] = []

  if (form) {
    try {
      for (const input of inputSchema) {
        if (String(input.kind || 'photo') !== 'photo') continue
        const id = String(input.id || '')
        if (!id) continue

        const upload = form.get(id)
        const suppliedUrl = String(form.get(`${id}_url`) || '')
        let uri = ''

        if (upload instanceof File && upload.size > 0) uri = await fileToDataUri(upload)
        else if (suppliedUrl.startsWith('https://')) uri = suppliedUrl
        else if (input.default_asset_url) uri = String(input.default_asset_url)

        if (!uri && input.required) {
          return NextResponse.json({ error: `MISSING_REFERENCE:${id}` }, { status: 400 })
        }
        if (uri) references.push(uri)
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INVALID_REFERENCE'
      const status = code === 'REFERENCE_IMAGE_TOO_LARGE' ? 413 : 400
      return NextResponse.json({ error: code }, { status })
    }
  }

  const tokenCost = Math.max(0, Number(trend.token_cost || 0))
  let newBalance: number | null = null
  if (tokenCost > 0) {
    const reserve = await rpc('reserve_tokens', {
      p_telegram_id: user.id,
      p_amount: tokenCost,
      p_reference: `trend:${trend.id}`,
    })
    if (!reserve.ok) {
      const text = await reserve.text()
      const insufficient = text.includes('INSUFFICIENT_TOKENS')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_TOKENS' : text }, { status: insufficient ? 402 : 500 })
    }
    newBalance = Number(await reserve.json())
  }

  const provider = String(trend.provider || '').toLowerCase()
  const model = String(trend.model || '').toLowerCase()
  const isRunway = provider === 'runway' && model === 'seedance2_5'
  const isBytePlus = provider === 'byteplus' && (model === 'dreamina-seedance-2-5-260628' || model === 'seedance2_5')

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'trend',
      source_id: trend.id,
      title: trend.title_en,
      status: isRunway || isBytePlus ? 'queued' : 'processing',
      token_cost: tokenCost,
      provider: trend.provider || 'mock',
      model: trend.model || 'mock-success',
      input_payload: {
        reference_count: references.length,
        reference_tags: inputSchema.filter((item) => item.kind === 'photo' || !item.kind).map((item) => item.tag).filter(Boolean),
        generate_audio: generateAudio,
      },
      queued_at: isRunway || isBytePlus ? new Date().toISOString() : null,
    }),
  })

  if (!historyResponse.ok) {
    if (tokenCost > 0) await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `history-failed:${trend.id}` })
    return NextResponse.json({ error: 'Could not create generation job' }, { status: 500 })
  }

  const job = (await historyResponse.json())?.[0]

  if (isRunway || isBytePlus) {
    if (!form) {
      if (tokenCost > 0) await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `missing-input:${job.id}` })
      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_code: 'INPUTS_NOT_UPLOADED', failed_at: new Date().toISOString(), refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
      return NextResponse.json({ error: 'INPUTS_NOT_UPLOADED' }, { status: 400 })
    }
  }

  if (isBytePlus) {
    try {
      const task = await createBytePlusSeedance25Task({
        promptText: String(trend.hidden_prompt || ''),
        duration: Math.max(4, Math.min(30, Number(trend.duration_seconds || 11))),
        ratio: ratioForBytePlus(trend.aspect_ratio),
        references,
        resolution: '480p',
        generateAudio,
      })

      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'processing',
          processing_at: new Date().toISOString(),
          result_metadata: { byteplus_task_id: task.id, byteplus_test_resolution: '480p' },
          updated_at: new Date().toISOString(),
        }),
      })

      return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, providerTaskId: task.id, tokenBalance: newBalance })
    } catch (error) {
      if (tokenCost > 0) {
        const refund = await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `byteplus-create-failed:${job.id}` })
        if (refund.ok) newBalance = Number(await refund.json())
      }
      const message = error instanceof Error ? error.message : 'BYTEPLUS_CREATE_FAILED'
      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_code: message.slice(0, 240), failed_at: new Date().toISOString(), refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
      return NextResponse.json({ error: 'BYTEPLUS_CREATE_FAILED', details: message, tokensRefunded: tokenCost, tokenBalance: newBalance }, { status: 502 })
    }
  }

  if (isRunway) {
    try {
      const task = await createSeedance25Task({
        promptText: String(trend.hidden_prompt || ''),
        duration: Math.max(4, Math.min(30, Number(trend.duration_seconds || 11))),
        ratio: ratioForRunway(trend.aspect_ratio),
        references,
        audio: generateAudio,
      })

      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'processing',
          processing_at: new Date().toISOString(),
          result_metadata: { runway_task_id: task.id, estimated_cost_credits: task.estimatedCost ?? null },
          updated_at: new Date().toISOString(),
        }),
      })

      return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, providerTaskId: task.id, tokenBalance: newBalance })
    } catch (error) {
      if (tokenCost > 0) {
        const refund = await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `runway-create-failed:${job.id}` })
        if (refund.ok) newBalance = Number(await refund.json())
      }
      const message = error instanceof Error ? error.message : 'RUNWAY_CREATE_FAILED'
      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error_code: message.slice(0, 240), failed_at: new Date().toISOString(), refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      })
      return NextResponse.json({ error: 'RUNWAY_CREATE_FAILED', details: message, tokensRefunded: tokenCost, tokenBalance: newBalance }, { status: 502 })
    }
  }

  const simulateFailure = provider === 'mock-error' || model === 'mock-error'
  if (simulateFailure) {
    if (tokenCost > 0) {
      const refund = await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `failed:${job.id}` })
      if (refund.ok) newBalance = Number(await refund.json())
    }
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', error_code: 'MOCK_PROVIDER_ERROR', updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, tokenBalance: newBalance, tokensRefunded: tokenCost, error: 'MOCK_PROVIDER_ERROR' })
  }

  const mockResultUrl = trend.preview_video_url || trend.image_url
  await supabaseFetch(`generation_history?id=eq.${job.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed', result_url: mockResultUrl, updated_at: new Date().toISOString() }),
  })

  return NextResponse.json({ ok: true, status: 'completed', jobId: job.id, resultUrl: mockResultUrl, tokenBalance: newBalance, mock: true })
}
