import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const key = process.env.APIMODELS_API_KEY
  if (!key) return NextResponse.json({ error: 'APIMODELS_API_NOT_CONFIGURED' }, { status: 503 })

  const response = await fetch('https://api.apimodels.app/v1/balance', {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })

  const text = await response.text()
  let body: unknown = text
  try { body = text ? JSON.parse(text) : {} } catch {}

  return NextResponse.json({ ok: response.ok, status: response.status, body }, { status: response.ok ? 200 : 502 })
}
