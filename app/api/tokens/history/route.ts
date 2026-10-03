import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

function safeIn(values: string[]) {
  return values.filter(Boolean).map((value) => value.replace(/[^0-9a-f-]/gi, '')).join(',')
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const url = new URL(request.url)
  const period = url.searchParams.get('period') || '30'
  const days = period === 'all' ? null : period === '90' ? 90 : 30
  const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null

  const ledgerPath = [
    'token_ledger?select=id,amount,event_type,reference,created_at,generation_id',
    `telegram_id=eq.${user.id}`,
    since ? `created_at=gte.${encodeURIComponent(since)}` : null,
    'order=created_at.desc',
    'limit=250',
  ].filter(Boolean).join('&')

  const ledgerResponse = await supabaseFetch(ledgerPath)
  if (!ledgerResponse.ok) return NextResponse.json({ error: 'History unavailable' }, { status: 503 })
  const rows = await ledgerResponse.json()

  const generationIds = Array.from(new Set(
    rows.map((row: any) => String(row.generation_id || '')).filter(Boolean),
  ))
  const paymentIds = Array.from(new Set(
    rows
      .map((row: any) => String(row.reference || '').match(/^tochka_payment:([0-9a-f-]+)$/i)?.[1] || '')
      .filter(Boolean),
  ))

  const generationMap = new Map<string, any>()
  const paymentMap = new Map<string, any>()

  if (generationIds.length) {
    const response = await supabaseFetch(
      `generation_history?select=id,title,source_id,type&id=in.(${safeIn(generationIds)})&telegram_id=eq.${user.id}`,
    )
    if (response.ok) {
      const data = await response.json()
      for (const item of data) generationMap.set(String(item.id), item)
    }
  }

  if (paymentIds.length) {
    const response = await supabaseFetch(
      `payment_orders?select=id,amount,currency,payment_method,status,paid_at&id=in.(${safeIn(paymentIds)})&telegram_id=eq.${user.id}`,
    )
    if (response.ok) {
      const data = await response.json()
      for (const item of data) paymentMap.set(String(item.id), item)
    }
  }

  const history = rows.map((row: any) => {
    const reference = String(row.reference || '')
    const generation = row.generation_id ? generationMap.get(String(row.generation_id)) : null
    const paymentId = reference.match(/^tochka_payment:([0-9a-f-]+)$/i)?.[1]
    const payment = paymentId ? paymentMap.get(paymentId) : null

    let kind = 'other'
    let title = 'Операция с Tokens'

    if (payment) {
      kind = 'purchase'
      title = 'Покупка Tokens'
    } else if (row.event_type === 'generation') {
      kind = 'spend'
      title = generation?.title || 'Генерация'
    } else if (row.event_type === 'refund') {
      kind = 'refund'
      title = generation?.title ? `Возврат: ${generation.title}` : 'Возврат Tokens'
    } else if (reference.startsWith('referral-conversion:')) {
      kind = 'referral'
      title = 'Начисление из реферального баланса'
    } else if (reference.startsWith('referral-gift:')) {
      kind = 'gift'
      title = 'Подарок Tokens'
    } else if (row.event_type === 'adjustment') {
      kind = 'adjustment'
      title = 'Корректировка баланса'
    } else if (row.event_type === 'credit') {
      kind = 'credit'
      title = 'Начисление Tokens'
    }

    return {
      id: row.id,
      amount: Number(row.amount || 0),
      eventType: row.event_type,
      kind,
      title,
      createdAt: row.created_at,
      rubAmount: payment ? Number(payment.amount || 0) : null,
      paymentMethod: payment?.payment_method || null,
    }
  })

  return NextResponse.json({ history })
}
