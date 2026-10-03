import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'
import { tochkaAuthHeaders, tochkaRequest } from '@/lib/server/tochka-http'
import { getTokenPurchaseQuote, normalizeTokenPurchaseAmount } from '@/lib/public-pricing'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  const isForm = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
  const body: any = isForm
    ? Object.fromEntries((await request.formData().catch(() => new FormData())).entries())
    : await request.json().catch(() => ({}))

  const initData = request.headers.get('x-telegram-init-data') || String(body?.initData || '')
  const user = verifyTelegramInitData(initData)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const token = process.env.TOCHKA_JWT

  let customerCode = process.env.TOCHKA_CUSTOMER_CODE || ''
  let merchantId = process.env.TOCHKA_MERCHANT_ID || ''
  let acquiringConfig: any = {}

  if (hasDatabase()) {
    const configResponse = await supabaseFetch(
      'app_settings?select=value&key=eq.tochka_acquiring_config&limit=1',
    )
    const configRows = configResponse.ok ? await configResponse.json() : []
    acquiringConfig = configRows?.[0]?.value || {}
    customerCode = customerCode || String(acquiringConfig?.customerCode || '')
    merchantId = merchantId || String(acquiringConfig?.merchantId || '')
  }
  const siteUrl = 'https://bananazero.ru'
  const taxSystemCode = process.env.TOCHKA_TAX_SYSTEM_CODE || 'usn_income'
  const vatType = process.env.TOCHKA_VAT_TYPE || 'none'
  if (!token || !customerCode || !merchantId || acquiringConfig?.setupComplete !== true) {
    return NextResponse.json({ error: 'Tochka fiscal checkout is not configured' }, { status: 503 })
  }

  const isTestPayment = body?.testPayment === true || String(body?.testPayment || '') === '1'

  let tokenAmount: number
  let quote: { tokens: number; regularRub: number; priceRub: number; savingsRub: number; discountPct: number }

  if (isTestPayment) {
    if (!hasDatabase()) return NextResponse.json({ error: 'Test checkout unavailable' }, { status: 503 })
    const testConfigResponse = await supabaseFetch(
      'app_settings?select=value&key=eq.test_checkout_users&limit=1',
    )
    const testRows = testConfigResponse.ok ? await testConfigResponse.json() : []
    const testConfig = testRows?.[0]?.value || {}
    const allowedIds = Array.isArray(testConfig?.telegram_ids) ? testConfig.telegram_ids.map(Number) : []
    if (testConfig?.enabled !== true || !allowedIds.includes(Number(user.id))) {
      return NextResponse.json({ error: 'Test checkout unavailable' }, { status: 403 })
    }

    tokenAmount = Number(testConfig?.token_amount || 100)
    const testAmount = Number(testConfig?.amount_rub || 100)
    quote = {
      tokens: tokenAmount,
      regularRub: testAmount,
      priceRub: testAmount,
      savingsRub: 0,
      discountPct: 0,
    }
  } else {
    const rawTokenAmount = Number(body?.tokenAmount)
    tokenAmount = normalizeTokenPurchaseAmount(rawTokenAmount)
    if (!Number.isFinite(rawTokenAmount) || rawTokenAmount !== tokenAmount) {
      return NextResponse.json({ error: 'Invalid checkout data' }, { status: 400 })
    }
    quote = getTokenPurchaseQuote(tokenAmount)
  }

  const amount = quote.priceRub
  const requestedPaymentMethod = String(body?.paymentMethod || '').trim()
  const paymentMethod = ['sbp', 'card', 'tinkoff'].includes(requestedPaymentMethod)
    ? requestedPaymentMethod
    : ''
  if (!paymentMethod) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })

  const email = String(body?.email || '').trim().slice(0, 254)
  const name = String(body?.name || '').trim().slice(0, 120) || 'Покупатель Banana Zero'
  if (!email.includes('@')) return NextResponse.json({ error: 'Invalid checkout data' }, { status: 400 })

  const requestedOrderId = String(body?.orderId || '')
  const orderId = UUID_RE.test(requestedOrderId) ? requestedOrderId : randomUUID()
  const paymentLinkId = orderId
  const providerPayload: any = {
    Data: {
      customerCode,
      amount,
      purpose: isTestPayment ? `Тестовый платеж Banana Zero: ${tokenAmount} токенов` : `Пополнение Banana Zero: ${tokenAmount} токенов`,
      redirectUrl: `${siteUrl}/pay/success?order=${orderId}`,
      failRedirectUrl: `${siteUrl}/pay?status=failed`,
      paymentMode: [paymentMethod],
      paymentLinkId,
      preAuthorization: false,
      taxSystemCode,
      Client: { name, email },
      Items: [{
        vatType,
        name: isTestPayment ? `Тестовый платеж Banana Zero — ${tokenAmount} токенов` : `${tokenAmount} токенов Banana Zero`,
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
          pricing_version: 'commercial_model_v4_slider',
          purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount, regular_rub: quote.regularRub, discount_pct: quote.discountPct, savings_rub: quote.savingsRub },
          test_payment: isTestPayment,
          selected_payment_method: paymentMethod,
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
    if (hasDatabase()) await supabaseFetch(`payment_orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', metadata: { email, name, offer_version: '2026-10-02-v2', pricing_version: 'commercial_model_v4_slider', selected_payment_method: paymentMethod, purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount, regular_rub: quote.regularRub, discount_pct: quote.discountPct, savings_rub: quote.savingsRub }, test_payment: isTestPayment, provider_error: data } }) })
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  if (hasDatabase()) {
    await supabaseFetch(`payment_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ external_payment_id: data.Data.operationId, payment_method: paymentMethod, metadata: { email, name, selected_payment_method: paymentMethod, offer_version: '2026-10-02-v2', pricing_version: 'commercial_model_v4_slider', purchase_snapshot: { token_amount: tokenAmount, amount_rub: amount, regular_rub: quote.regularRub, discount_pct: quote.discountPct, savings_rub: quote.savingsRub }, test_payment: isTestPayment, payment_link_id: paymentLinkId, payment_link: data.Data.paymentLink } }),
    })
  }

  if (isForm && String(body?.redirect || '') === '1') {
    return NextResponse.redirect(data.Data.paymentLink, 303)
  }

  return NextResponse.json({ orderId, paymentLink: data.Data.paymentLink })
}
