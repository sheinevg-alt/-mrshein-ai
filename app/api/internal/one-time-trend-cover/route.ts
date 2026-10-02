import { NextResponse } from 'next/server'
import { supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supplied = request.headers.get('x-one-time-token') || ''
  const settingsResponse = await supabaseFetch(
    'app_settings?select=value&key=eq.one_time_trend_cover_upload&limit=1',
  )
  const settingsRows = settingsResponse.ok ? await settingsResponse.json() : []
  const value = settingsRows?.[0]?.value || {}

  if (value?.enabled !== true || !value?.token || supplied !== String(value.token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trendId = String(value.trend_id || '')
  if (trendId !== 'trend1-jump-car-v11-test') {
    return NextResponse.json({ error: 'Invalid trend' }, { status: 400 })
  }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase()
  if (contentType !== 'image/jpeg') {
    return NextResponse.json({ error: 'JPEG_REQUIRED' }, { status: 415 })
  }

  const bytes = Buffer.from(await request.arrayBuffer())
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'INVALID_IMAGE_SIZE' }, { status: 413 })
  }

  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  if (!base || !key) return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })

  const objectPath = 'trend-covers/trend1-jump-car-v11-test-20261002.jpg'
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
  const upload = await fetch(`${base}/storage/v1/object/trend-previews/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: bytes,
  })

  if (!upload.ok) {
    const details = await upload.text().catch(() => '')
    return NextResponse.json({ error: 'UPLOAD_FAILED', details }, { status: 502 })
  }

  const publicUrl = `${base}/storage/v1/object/public/trend-previews/${objectPath}`
  const trendUpdate = await supabaseFetch(
    `trends?id=eq.${encodeURIComponent(trendId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ image_url: publicUrl }),
    },
  )
  if (!trendUpdate.ok) {
    return NextResponse.json({ error: 'TREND_UPDATE_FAILED' }, { status: 500 })
  }

  await supabaseFetch('app_settings?key=eq.one_time_trend_cover_upload', {
    method: 'PATCH',
    body: JSON.stringify({
      value: { enabled: false, token: null, trend_id: trendId },
    }),
  })

  return NextResponse.json({ ok: true, imageUrl: publicUrl })
}
