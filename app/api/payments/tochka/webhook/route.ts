import { createPublicKey, verify } from 'crypto'
import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { tochkaRequest } from '@/lib/server/tochka-http'

export const dynamic = 'force-dynamic'

const TOCHKA_PUBLIC_KEY_URL = 'https://enter.tochka.com/doc/openapi/static/keys/public'

function decodeJsonSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

async function verifyTochkaJwt(raw: string) {
  const parts = raw.trim().split('.')
  if (parts.length !== 3) throw new Error('INVALID_JWT')
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJsonSegment(encodedHeader)
  if (header?.alg !== 'RS256') throw new Error('INVALID_ALG')

  const keyResponse = await tochkaRequest('/doc/openapi/static/keys/public')
  if (!keyResponse.ok) throw new Error('PUBLIC_KEY_UNAVAILABLE')
  const keyData = keyResponse.json
  const jwk = Array.isArray(keyData?.keys) ? keyData.keys[0] : keyData
  if (!jwk?.kty || !jwk?.n || !jwk?.e) throw new Error('INVALID_PUBLIC_KEY')

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
  const ok = verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, 'base64url'),
  )
  if (!ok) throw new Error('INVALID_SIGNATURE')
  return decodeJsonSegment(encodedPayload) as Record<string, unknown>
}

async function getAcquiringConfig() {
  const response = await supabaseFetch(
    'app_settings?select=value&key=eq.tochka_acquiring_config&limit=1',
  )
  const rows = response.ok ? await response.json() : []
  return rows?.[0]?.value || null
}

export async function POST(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ ok: false }, { status: 503 })

  const raw = await request.text()
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 })

  let payload: Record<string, any>
  try {
    payload = await verifyTochkaJwt(raw)
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Tochka sends a signed test event while the webhook URL is being registered.
  // A valid signed event must receive HTTP 200 even when it is not a real payment.
  if (payload.webhookType !== 'acquiringInternetPayment') {
    return NextResponse.json({ ok: true })
  }

  if (payload.status !== 'APPROVED') {
    return NextResponse.json({ ok: true })
  }

  const paymentLinkId = String(payload.paymentLinkId || '')
  const operationId = String(payload.operationId || '')
  const customerCode = String(payload.customerCode || '')
  const merchantId = String(payload.merchantId || '')
  const paymentType = String(payload.paymentType || '')
  const amount = Number(payload.amount)

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentLinkId) ||
    !operationId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return NextResponse.json({ ok: true })
  }

  const config = await getAcquiringConfig()
  if (
    !config?.customerCode ||
    !config?.merchantId ||
    customerCode !== String(config.customerCode) ||
    merchantId !== String(config.merchantId)
  ) {
    return NextResponse.json({ ok: true })
  }

  const complete = await supabaseFetch('rpc/complete_tochka_payment', {
    method: 'POST',
    body: JSON.stringify({
      p_order_id: paymentLinkId,
      p_operation_id: operationId,
      p_amount: amount,
      p_customer_code: customerCode,
      p_merchant_id: merchantId,
      p_payment_type: paymentType,
    }),
  })

  if (!complete.ok) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
