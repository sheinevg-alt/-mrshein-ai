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

async function saveConfig(value: Record<string, unknown>) {
  const existing = await supabaseFetch(
    'app_settings?select=key&key=eq.tochka_acquiring_config&limit=1',
  )
  const rows = existing.ok ? await existing.json() : []
  return rows?.length
    ? supabaseFetch('app_settings?key=eq.tochka_acquiring_config', {
        method: 'PATCH',
        body: JSON.stringify({
          value,
          description: 'Internal Tochka internet acquiring configuration.',
          updated_at: new Date().toISOString(),
        }),
      })
    : supabaseFetch('app_settings', {
        method: 'POST',
        body: JSON.stringify({
          key: 'tochka_acquiring_config',
          value,
          description: 'Internal Tochka internet acquiring configuration.',
        }),
      })
}

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ ok: false, stage: 'database' }, { status: 503 })

  const token = process.env.TOCHKA_JWT
  let clientId = process.env.TOCHKA_CLIENT_ID || ''

  if (token && !clientId) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'))
      clientId = String(payload?.client_id || payload?.clientId || '')
    } catch {
      clientId = ''
    }
  }

  if (!token) {
    return NextResponse.json({ ok: false, stage: 'environment', hasJwt: false, hasClientId: Boolean(clientId) }, { status: 503 })
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
  let webhookConfigured = false
  let webhookVerified = false

  if (clientId) {
    const webhook = await tochka(`/webhook/v1.0/${encodeURIComponent(clientId)}`, token, {
      method: 'PUT',
      body: JSON.stringify({
        webhooksList: ['acquiringInternetPayment'],
        url: WEBHOOK_URL,
      }),
    })

    if (!webhook.response.ok) {
      await saveConfig({
        customerCode,
        merchantId,
        clientId,
        webhookUrl: WEBHOOK_URL,
        webhookEvent: 'acquiringInternetPayment',
        webhookConfigured: false,
        taxSystemCode: 'usn_income',
        vatType: 'none',
        configuredAt: new Date().toISOString(),
      })
      return NextResponse.json({
        ok: false,
        stage: 'webhook',
        customerConfigured: true,
        retailerConfigured: true,
        status: webhook.response.status,
        code: webhook.data?.code || webhook.data?.errorCode || null,
      }, { status: 502 })
    }

    webhookConfigured = true
    const verifyWebhook = await tochka(`/webhook/v1.0/${encodeURIComponent(clientId)}`, token)
    webhookVerified = verifyWebhook.response.ok
  }

  const configValue = {
    customerCode,
    merchantId,
    clientId: clientId || null,
    webhookUrl: WEBHOOK_URL,
    webhookEvent: 'acquiringInternetPayment',
    webhookConfigured,
    webhookVerified,
    taxSystemCode: 'usn_income',
    vatType: 'none',
    setupComplete: Boolean(clientId && webhookConfigured && webhookVerified),
    configuredAt: new Date().toISOString(),
  }

  const save = await saveConfig(configValue)
  if (!save.ok) return NextResponse.json({ ok: false, stage: 'save_config' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    customerConfigured: true,
    retailerConfigured: true,
    clientIdConfigured: Boolean(clientId),
    webhookConfigured,
    webhookVerified,
    fiscalization: '54-FZ',
    taxSystem: 'usn_income',
    vat: 'none',
  })
}
