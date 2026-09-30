import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const trendId = String(body?.trendId || '')
  if (!trendId) return NextResponse.json({ error: 'trendId is required' }, { status: 400 })

  const trendResponse = await supabaseFetch(
    `trends?select=id,title_en,title_ru,category,image_url,preview_video_url,token_cost,provider,model,published&id=eq.${encodeURIComponent(trendId)}&limit=1`,
  )
  const trends = trendResponse.ok ? await trendResponse.json() : []
  const trend = trends?.[0]
  if (!trend?.published) return NextResponse.json({ error: 'Trend not found' }, { status: 404 })

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

  const historyResponse = await supabaseFetch('generation_history', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      type: 'trend',
      source_id: trend.id,
      title: trend.title_en,
      status: 'processing',
      token_cost: tokenCost,
      provider: trend.provider || 'mock',
      model: trend.model || 'mock-success',
    }),
  })

  if (!historyResponse.ok) {
    if (tokenCost > 0) await rpc('refund_tokens', { p_telegram_id: user.id, p_amount: tokenCost, p_reference: `history-failed:${trend.id}` })
    return NextResponse.json({ error: 'Could not create generation job' }, { status: 500 })
  }

  const job = (await historyResponse.json())?.[0]
  const simulateFailure = String(trend.provider || '').toLowerCase() === 'mock-error' || String(trend.model || '').toLowerCase() === 'mock-error'

  if (simulateFailure) {
    if (tokenCost > 0) {
      const refund = await rpc('refund_tokens', {
        p_telegram_id: user.id,
        p_amount: tokenCost,
        p_reference: `failed:${job.id}`,
      })
      if (refund.ok) newBalance = Number(await refund.json())
    }
    await supabaseFetch(`generation_history?id=eq.${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', error_code: 'MOCK_PROVIDER_ERROR', updated_at: new Date().toISOString() }),
    })
    return NextResponse.json({
      ok: false,
      status: 'failed',
      jobId: job.id,
      tokenBalance: newBalance,
      tokensRefunded: tokenCost,
      error: 'MOCK_PROVIDER_ERROR',
    })
  }

  // Until real AI providers are connected, the mock adapter completes immediately
  // and uses the trend preview video (or cover image) as a harmless stand-in result.
  const mockResultUrl = trend.preview_video_url || trend.image_url
  await supabaseFetch(`generation_history?id=eq.${job.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed', result_url: mockResultUrl, updated_at: new Date().toISOString() }),
  })

  return NextResponse.json({
    ok: true,
    status: 'completed',
    jobId: job.id,
    resultUrl: mockResultUrl,
    tokenBalance: newBalance,
    mock: true,
  })
}
