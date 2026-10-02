import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'
import { tochkaAuthHeaders, tochkaRequest } from '@/lib/server/tochka-http'

export const dynamic = 'force-dynamic'

const PACKS = new Map<number, number>([[200,500],[500,1250],[1000,2500],[2000,5000]])

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_RUBLE_CHECKOUT_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Ruble checkout is not enabled yet' }, { status: 503 })
  }

  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const token = process.env.TOCHKA_JWT

  let customerCode = process.env.TOCHKA_CUSTOMER_CODE || ''
  let merchantId = process.env.TOCHKA_MERCHANT_ID || ''

  if (hasDatabase() && (!customerCode || !merchantId)) {
    const configResponse = await supabaseFetch(
      'app_settings?select=value&key=eq.tochka_acquiring_config&limit=1',
    )
    const configRows = configResponse.ok ? await configResponse.json() : []
    const acquiringConfig = configRows?.[0]?.value || {}
    customerCode = customerCode || String(acquiringConfig?.customerCode || '')
    merchantId = merchantId || String(acquiringConfig?.merchantId || '')
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const taxSystemCode = process.env.TOCHKA_TAX_SYSTEM_CODE || 'usn_income'
  const vatType = process.env.TOCHKA_VAT_TYPE || 'none'
  if (!token || !customerCode || !merchantId) {
    return NextResponse.json({ error: 'Tochka fiscal checkout is not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const tokenAmount = Number(body?.tokenAmount)
  const amount = PACKS.get(tokenAmount)
  const email = String(body?.email || '').trim().slice(0, 254)
  const name = String(body?.name || '').trim().slice(0, 120) || 'Покупатель Banana Zero'
  if (!amount || !email.includes('@')) return NextResponse.json({ error: 'Invalid checkout data' }, { status: 400 })

  const orderId = randomUUID()
  const paymentLinkId = orderId
  const providerPayload: any = {
    Data: {
      customerCode,
      amount,
      purpose: `Пополнение Banana Zero: ${tokenAmount} токенов`,
      redirectUrl: `${siteUrl}/pay/success?order=${orderId}`,
      failRedirectUrl: `${siteUrl}/pay?status=failed`,
      paymentMode: ['sbp', 'card', 'tinkoff'],
      paymentLinkId,
      preAuthorization: false,
      taxSystemCode,
      Client: { name, email },
      Items: [{
        vatType,
        name: `${tokenAmount} токенов Banana Zero`,
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
        telegram_id: user.id,
        channel: 'web',
        provider: 'tochka',
        status: 'pending',
        currency: 'RUB',
        amount,
        token_amount: tokenAmount,
        purchase_type: 'token_topup',
        idempotency_key: paymentLinkId,
        return_url: `${siteUrl}/pay/success?order=${orderId}`,
        metadata: {
          email,
          name,
          offer_version: '2026-10-02-v2',
          pricing_version: 'commercial_model_v3',
          purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount },
          customer_code: customerCode,
          merchant_id: merchantId,
        },
      }),
    })
  }

  const response = await tochkaRequest('/uapi/acquiring/v1.0/payments_with_receipt', {
    method: 'POST',
    headers: tochkaAuthHeaders(token, true),
    body: JSON.stringify(providerPayload),
  })

  const data = response.json
  if (!response.ok || !data?.Data?.paymentLink) {
    if (hasDatabase()) await supabaseFetch(`payment_orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', metadata: { email, name, offer_version: '2026-10-02-v2', pricing_version: 'commercial_model_v3', purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount }, provider_error: data } }) })
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  if (hasDatabase()) {
    await supabaseFetch(`payment_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ external_payment_id: data.Data.operationId, payment_method: 'payment_link', metadata: { email, name, offer_version: '2026-10-02-v2', pricing_version: 'commercial_model_v3', purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount }, payment_link_id: paymentLinkId } }),
    })
  }

  return NextResponse.json({ orderId, paymentLink: data.Data.paymentLink })
}
