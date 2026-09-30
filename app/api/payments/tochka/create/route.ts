import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const PACKS = new Map<number, number>([[300,300],[560,560],[1000,1000]])

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_RUBLE_CHECKOUT_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Ruble checkout is not enabled yet' }, { status: 503 })
  }

  const token = process.env.TOCHKA_JWT
  const customerCode = process.env.TOCHKA_CUSTOMER_CODE
  const merchantId = process.env.TOCHKA_MERCHANT_ID
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const taxSystemCode = process.env.TOCHKA_TAX_SYSTEM_CODE || 'usn_income'
  const vatType = process.env.TOCHKA_VAT_TYPE || 'none'
  if (!token || !customerCode) return NextResponse.json({ error: 'Tochka is not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const tokenAmount = Number(body?.tokenAmount)
  const amount = PACKS.get(tokenAmount)
  const email = String(body?.email || '').trim().slice(0, 254)
  const name = String(body?.name || '').trim().slice(0, 120) || 'Покупатель Shein AI'
  if (!amount || !email.includes('@')) return NextResponse.json({ error: 'Invalid checkout data' }, { status: 400 })

  const orderId = randomUUID()
  const paymentLinkId = orderId
  const providerPayload: any = {
    Data: {
      customerCode,
      amount,
      purpose: `Пополнение Shein AI: ${tokenAmount} токенов`,
      redirectUrl: `${siteUrl}/pay/success?order=${orderId}`,
      failRedirectUrl: `${siteUrl}/pay?status=failed`,
      paymentMode: ['sbp', 'card', 'tinkoff'],
      paymentLinkId,
      taxSystemCode,
      Client: { name, email },
      Items: [{
        vatType,
        name: `${tokenAmount} токенов Shein AI`,
        amount,
        quantity: 1,
        paymentMethod: 'full_payment',
        paymentObject: 'service',
        measure: 'шт.',
      }],
    },
  }
  if (merchantId) providerPayload.Data.merchantId = merchantId

  if (hasDatabase()) {
    await supabaseFetch('payment_orders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: orderId,
        channel: 'web',
        provider: 'tochka',
        status: 'pending',
        currency: 'RUB',
        amount,
        token_amount: tokenAmount,
        idempotency_key: paymentLinkId,
        return_url: `${siteUrl}/pay/success?order=${orderId}`,
        metadata: { email, name },
      }),
    })
  }

  const response = await fetch('https://enter.tochka.com/uapi/acquiring/v1.0/payments_with_receipt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(providerPayload),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.Data?.paymentLink) {
    if (hasDatabase()) await supabaseFetch(`payment_orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', metadata: { email, name, provider_error: data } }) })
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  if (hasDatabase()) {
    await supabaseFetch(`payment_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ external_payment_id: data.Data.operationId, payment_method: 'payment_link', metadata: { email, name, payment_link_id: paymentLinkId } }),
    })
  }

  return NextResponse.json({ orderId, paymentLink: data.Data.paymentLink })
}
