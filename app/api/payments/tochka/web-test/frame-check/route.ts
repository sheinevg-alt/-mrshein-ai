import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const url = new URL(request.url)
  const key = url.searchParams.get('key') || ''
  const order = url.searchParams.get('order') || ''

  const cfgResponse = await supabaseFetch('app_settings?select=value&key=eq.web_test_checkout&limit=1')
  const cfgRows = cfgResponse.ok ? await cfgResponse.json() : []
  const cfg = cfgRows?.[0]?.value || {}
  if (!cfg?.access_key || key !== String(cfg.access_key)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orderResponse = await supabaseFetch(
    'payment_orders?select=metadata&id=eq.' + encodeURIComponent(order) + '&limit=1',
  )
  const rows = orderResponse.ok ? await orderResponse.json() : []
  const paymentLink = String(rows?.[0]?.metadata?.payment_link || '')
  if (!paymentLink) return NextResponse.json({ error: 'Payment link missing' }, { status: 404 })

  const response = await fetch(paymentLink, { redirect: 'manual', cache: 'no-store' })
  return NextResponse.json({
    status: response.status,
    location: response.headers.get('location'),
    xFrameOptions: response.headers.get('x-frame-options'),
    contentSecurityPolicy: response.headers.get('content-security-policy'),
    crossOriginOpenerPolicy: response.headers.get('cross-origin-opener-policy'),
  })
}
