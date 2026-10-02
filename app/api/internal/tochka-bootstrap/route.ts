import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { tochkaAuthHeaders, tochkaRequest } from '@/lib/server/tochka-http'

export const dynamic = 'force-dynamic'

const WEBHOOK_URL = 'https://bananazero.ru/api/payments/tochka/webhook'

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

  const customers = await tochkaRequest('/uapi/open-banking/v1.0/customers', { headers: tochkaAuthHeaders(token) })
  if (!customers.ok) {
    return NextResponse.json({ ok: false, stage: 'customers', status: customers.status }, { status: 502 })
  }

  const rawCustomers =
    customers.json?.Data?.Customer ||
    customers.json?.Data?.Customers ||
    customers.json?.Data?.customers ||
    customers.json?.customers ||
    []
  const businesses = (Array.isArray(rawCustomers) ? rawCustomers : [rawCustomers])
    .filter((item: any) => item?.customerType === 'Business' && item?.customerCode)

  if (businesses.length !== 1) {
    return NextResponse.json({ ok: false, stage: 'select_customer', count: businesses.length }, { status: 409 })
  }

  const customerCode = String(businesses[0].customerCode)

  const retailers = await tochkaRequest(
    `/uapi/acquiring/v1.0/retailers?customerCode=${encodeURIComponent(customerCode)}`,
    { headers: tochkaAuthHeaders(token) },
  )
  if (!retailers.ok) {
    return NextResponse.json({ ok: false, stage: 'retailers', status: retailers.status }, { status: 502 })
  }

  const rawRetailers =
    retailers.json?.Data?.Retailer ||
    retailers.json?.Data?.Retailers ||
    retailers.json?.Data?.retailers ||
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
    const webhook = await tochkaRequest(`/uapi/webhook/v1.0/${encodeURIComponent(clientId)}`, {
      method: 'PUT',
      headers: tochkaAuthHeaders(token, true),
      body: JSON.stringify({
        webhooksList: ['acquiringInternetPayment'],
        url: WEBHOOK_URL,
      }),
    })

    if (!webhook.ok) {
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
        status: webhook.status,
        code: webhook.json?.code || webhook.json?.errorCode || null,
      }, { status: 502 })
    }

    webhookConfigured = true
    const verifyWebhook = await tochkaRequest(`/uapi/webhook/v1.0/${encodeURIComponent(clientId)}`, { headers: tochkaAuthHeaders(token) })
    webhookVerified = verifyWebhook.ok
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
