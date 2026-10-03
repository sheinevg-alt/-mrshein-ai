import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const orderId = new URL(request.url).searchParams.get('order') || ''
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }

  const response = await supabaseFetch(
    `payment_orders?select=status,token_amount,amount,paid_at&id=eq.${encodeURIComponent(orderId)}&provider=eq.tochka&limit=1`,
  )
  if (!response.ok) return NextResponse.json({ error: 'Status unavailable' }, { status: 503 })

  const rows = await response.json()
  const order = rows?.[0]
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  return NextResponse.json({
    status: order.status,
    tokenAmount: order.token_amount,
    amountRub: Number(order.amount || 0),
    paidAt: order.paid_at,
  })
}
