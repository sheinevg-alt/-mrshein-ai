import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const API = 'https://enter.tochka.com/uapi'
const WEBHOOK_URL = 'https://bananazero.ru/api/payments/tochka/webhook'

async function tochka(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' })
  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  return { response, data }
}

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ ok: false, stage: 'database' }, { status: 503 })

  const token = process.env.TOCHKA_JWT
  const clientId = process.env.TOCHKA_CLIENT_ID
  if (!token || !clientId) {
    return NextResponse.json({ ok: false, stage: 'environment', hasJwt: Boolean(token), hasClientId: Boolean(clientId) }, { status: 503 })
  }

  const customers = await tochka('/open-banking/v1.0/customers', token)
  if (!customers.response.ok) {
    return NextResponse.json({ ok: false, stage: 'customers', status: customers.response.status }, { status: 502 })
  }

  const rawCustomers =
    customers.data?.Data?.Customer ||
    customers.data?.Data?.Customers ||
    customers.data?.Data?.customers ||
    customers.data?.customers ||
    []
  const businesses = (Array.isArray(rawCustomers) ? rawCustomers : [rawCustomers])
    .filter((item: any) => item?.customerType === 'Business' && item?.customerCode)

  if (businesses.length !== 1) {
    return NextResponse.json({ ok: false, stage: 'select_customer', count: businesses.length }, { status: 409 })
  }

  const customerCode = String(businesses[0].customerCode)

  const retailers = await tochka(
    `/acquiring/v1.0/retailers?customerCode=${encodeURIComponent(customerCode)}`,
    token,
  )
  if (!retailers.response.ok) {
    return NextResponse.json({ ok: false, stage: 'retailers', status: retailers.response.status }, { status: 502 })
  }

  const rawRetailers =
    retailers.data?.Data?.Retailer ||
    retailers.data?.Data?.Retailers ||
    retailers.data?.Data?.retailers ||
    []
  const active = (Array.isArray(rawRetailers) ? rawRetailers : [rawRetailers])
    .filter((item: any) => item?.status === 'REG' && item?.isActive === true && item?.merchantId)

  let selected = active.find((item: any) => String(item?.url || '').includes('bananazero.ru'))
  if (!selected && active.length === 1) selected = active[0]

  if (!selected) {
    return NextResponse.json({ ok: false, stage: 'select_retailer', count: active.length }, { status: 409 })
  }

  const merchantId = String(selected.merchantId)

  const webhook = await tochka(`/webhook/v1.0/${encodeURIComponent(clientId)}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      webhooksList: ['acquiringInternetPayment'],
      url: WEBHOOK_URL,
    }),
  })

  if (!webhook.response.ok) {
    return NextResponse.json({
      ok: false,
      stage: 'webhook',
      status: webhook.response.status,
      code: webhook.data?.code || webhook.data?.errorCode || null,
    }, { status: 502 })
  }

  const configValue = {
    customerCode,
    merchantId,
    clientId,
    webhookUrl: WEBHOOK_URL,
    webhookEvent: 'acquiringInternetPayment',
    taxSystemCode: 'usn_income',
    vatType: 'none',
    setupComplete: true,
    configuredAt: new Date().toISOString(),
  }

  const existing = await supabaseFetch(
    'app_settings?select=key&key=eq.tochka_acquiring_config&limit=1',
  )
  const existingRows = existing.ok ? await existing.json() : []

  const save = existingRows?.length
    ? await supabaseFetch('app_settings?key=eq.tochka_acquiring_config', {
        method: 'PATCH',
        body: JSON.stringify({
          value: configValue,
          description: 'Internal Tochka internet acquiring configuration.',
          updated_at: new Date().toISOString(),
        }),
      })
    : await supabaseFetch('app_settings', {
        method: 'POST',
        body: JSON.stringify({
          key: 'tochka_acquiring_config',
          value: configValue,
          description: 'Internal Tochka internet acquiring configuration.',
        }),
      })

  if (!save.ok) {
    return NextResponse.json({ ok: false, stage: 'save_config' }, { status: 500 })
  }

  const verifyWebhook = await tochka(`/webhook/v1.0/${encodeURIComponent(clientId)}`, token)

  return NextResponse.json({
    ok: true,
    customerConfigured: true,
    retailerConfigured: true,
    webhookConfigured: webhook.response.ok,
    webhookVerified: verifyWebhook.response.ok,
    fiscalization: '54-FZ',
    taxSystem: 'usn_income',
    vat: 'none',
  })
}
