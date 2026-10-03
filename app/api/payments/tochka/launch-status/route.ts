import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ ready: false }, { status: 503 })

  const orderId = new URL(request.url).searchParams.get('order') || ''
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ ready: false, error: 'Invalid order' }, { status: 400 })
  }

  const response = await supabaseFetch(
    'payment_orders?select=status,metadata,created_at&id=eq.' + encodeURIComponent(orderId) + '&provider=eq.tochka&limit=1',
  )
  if (!response.ok) return NextResponse.json({ ready: false }, { status: 503 })

  const rows = await response.json()
  const order = rows?.[0]
  if (!order) return NextResponse.json({ ready: false })

  const createdAt = new Date(order.created_at).getTime()
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 20 * 60 * 1000) {
    return NextResponse.json({ ready: false, expired: true })
  }

  const paymentLink = String(order?.metadata?.payment_link || '')
  if (paymentLink) {
    return NextResponse.json({ ready: true, paymentLink, status: order.status })
  }

  if (order.status === 'failed' || order.status === 'canceled') {
    return NextResponse.json({ ready: false, failed: true, status: order.status })
  }

  return NextResponse.json({ ready: false, status: order.status })
}
