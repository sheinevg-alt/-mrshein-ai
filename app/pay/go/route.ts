import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f-]{36}$/i
const ALLOWED_HOST = 'merch.securepaytb.ru'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const orderId = requestUrl.searchParams.get('order') || ''

  if (!UUID_RE.test(orderId) || !hasDatabase()) {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }

  const response = await supabaseFetch(
    'payment_orders?select=status,metadata,created_at&id=eq.' +
      encodeURIComponent(orderId) +
      '&provider=eq.tochka&limit=1',
  )

  if (!response.ok) {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }

  const rows = await response.json()
  const order = rows?.[0]
  const paymentLink = String(order?.metadata?.payment_link || '')
  const createdAt = new Date(order?.created_at || 0).getTime()

  try {
    const target = new URL(paymentLink)
    if (
      !order ||
      target.protocol !== 'https:' ||
      target.hostname !== ALLOWED_HOST ||
      !Number.isFinite(createdAt) ||
      Date.now() - createdAt > 20 * 60 * 1000
    ) {
      return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
    }

    return NextResponse.redirect(target, 302)
  } catch {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }
}
