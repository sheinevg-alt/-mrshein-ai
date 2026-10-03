import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const CODE_RE = /^[0-9a-f]{8}$/i
const ALLOWED_HOST = 'merch.securepaytb.ru'

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  const requestUrl = new URL(request.url)

  if (!CODE_RE.test(code) || !hasDatabase()) {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }

  const response = await supabaseFetch(
    'payment_orders?select=id,status,metadata,created_at&provider=eq.tochka&order=created_at.desc&limit=100',
  )

  if (!response.ok) {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }

  const rows = await response.json()
  const matches = Array.isArray(rows)
    ? rows.filter((row: any) => String(row?.id || '').toLowerCase().startsWith(code.toLowerCase()))
    : []

  if (matches.length !== 1) {
    return NextResponse.redirect(new URL('/pay?status=failed', requestUrl), 302)
  }

  const order = matches[0]
  const createdAt = new Date(order?.created_at || 0).getTime()
  const paymentLink = String(order?.metadata?.payment_link || '')

  try {
    const target = new URL(paymentLink)
    if (
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
