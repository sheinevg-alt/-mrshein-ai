import { randomUUID, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { tochkaAuthHeaders, tochkaRequest } from '@/lib/server/tochka-http'

export const dynamic = 'force-dynamic'

function sameSecret(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const accessKey = String(body?.accessKey || '')
  const email = String(body?.email || '').trim().slice(0, 254)
  const name = String(body?.name || '').trim().slice(0, 120) || 'Покупатель Banana Zero'

  if (!email.includes('@')) return NextResponse.json({ error: 'Укажите корректный email для чека' }, { status: 400 })

  const testResponse = await supabaseFetch(
    'app_settings?select=value&key=eq.web_test_checkout&limit=1',
  )
  const testRows = testResponse.ok ? await testResponse.json() : []
  const testConfig = testRows?.[0]?.value || {}
  const expectedKey = String(testConfig?.access_key || '')

  if (
    testConfig?.enabled !== true ||
    !expectedKey ||
    !accessKey ||
    !sameSecret(accessKey, expectedKey)
  ) {
    return NextResponse.json({ error: 'Web test checkout unavailable' }, { status: 403 })
  }

  const amount = Number(testConfig?.amount_rub || 100)
  const tokenAmount = Number(testConfig?.token_amount || 100)
  const accountTelegramId = Number(testConfig?.account_telegram_id || 0)

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(tokenAmount) || tokenAmount <= 0 || !Number.isFinite(accountTelegramId) || !accountTelegramId) {
    return NextResponse.json({ error: 'Web test checkout misconfigured' }, { status: 503 })
  }

  const token = process.env.TOCHKA_JWT
  let customerCode = process.env.TOCHKA_CUSTOMER_CODE || ''
  let merchantId = process.env.TOCHKA_MERCHANT_ID || ''

  const configResponse = await supabaseFetch(
    'app_settings?select=value&key=eq.tochka_acquiring_config&limit=1',
  )
  const configRows = configResponse.ok ? await configResponse.json() : []
  const acquiringConfig = configRows?.[0]?.value || {}
  customerCode = customerCode || String(acquiringConfig?.customerCode || '')
  merchantId = merchantId || String(acquiringConfig?.merchantId || '')

  if (!token || !customerCode || !merchantId || acquiringConfig?.setupComplete !== true) {
    return NextResponse.json({ error: 'Tochka checkout is not configured' }, { status: 503 })
  }

  const orderId = randomUUID()
  const paymentLinkId = orderId
  const siteUrl = 'https://bananazero.ru'
  const taxSystemCode = process.env.TOCHKA_TAX_SYSTEM_CODE || 'usn_income'
  const vatType = process.env.TOCHKA_VAT_TYPE || 'none'

  const providerPayload: any = {
    Data: {
      customerCode,
      merchantId,
      amount,
      purpose: 'Тестовый веб-платёж Banana Zero',
      redirectUrl: `${siteUrl}/pay/success?order=${orderId}&channel=web`,
      failRedirectUrl: `${siteUrl}/pay/success?order=${orderId}&channel=web&status=failed`,
      paymentMode: ['sbp', 'card', 'tinkoff'],
      paymentLinkId,
      preAuthorization: false,
      taxSystemCode,
      Client: { name, email },
      Items: [{
        vatType,
        name: `Тестовый веб-платёж Banana Zero — ${tokenAmount} токенов`,
        amount,
        quantity: 1,
        paymentMethod: 'full_payment',
        paymentObject: 'service',
        measure: 'шт.',
      }],
    },
  }

  const orderCreate = await supabaseFetch('payment_orders', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: orderId,
      telegram_id: accountTelegramId,
      channel: 'web',
      provider: 'tochka',
      status: 'pending',
      currency: 'RUB',
      amount,
      token_amount: tokenAmount,
      purchase_type: 'token_topup',
      idempotency_key: paymentLinkId,
      return_url: `${siteUrl}/pay/success?order=${orderId}&channel=web`,
      metadata: {
        email,
        name,
        web_test_checkout: true,
        test_payment: true,
        source: 'website-browser-test',
        customer_code: customerCode,
        merchant_id: merchantId,
        purchase_snapshot: {
          token_amount: tokenAmount,
          amount_rub: amount,
        },
      },
    }),
  })

  if (!orderCreate.ok) {
    return NextResponse.json({ error: 'Could not create web test order' }, { status: 500 })
  }

  const response = await tochkaRequest('/uapi/acquiring/v1.0/payments_with_receipt', {
    method: 'POST',
    headers: tochkaAuthHeaders(token, true),
    body: JSON.stringify(providerPayload),
  })

  const data = response.json
  if (!response.ok || !data?.Data?.paymentLink) {
    await supabaseFetch(`payment_orders?id=eq.${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'failed',
        metadata: {
          email,
          name,
          web_test_checkout: true,
          test_payment: true,
          source: 'website-browser-test',
          provider_error: data,
        },
      }),
    })
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  await supabaseFetch(`payment_orders?id=eq.${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      external_payment_id: data.Data.operationId,
      payment_method: 'payment_link',
      metadata: {
        email,
        name,
        web_test_checkout: true,
        test_payment: true,
        source: 'website-browser-test',
        payment_link_id: paymentLinkId,
        payment_link: data.Data.paymentLink,
        purchase_snapshot: {
          token_amount: tokenAmount,
          amount_rub: amount,
        },
      },
    }),
  })

  return NextResponse.json({
    ok: true,
    orderId,
    paymentLink: data.Data.paymentLink,
    amountRub: amount,
    tokenAmount,
  })
}
