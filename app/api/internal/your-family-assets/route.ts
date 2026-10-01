import { NextResponse } from 'next/server'
import { createStorageSignedUploadUrl, hasDatabase } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const BUCKET = 'trend-previews'
const ALLOWED = new Set(['preview.mp4', 'poster.jpg'])

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const name = String(new URL(request.url).searchParams.get('name') || '')
  if (!ALLOWED.has(name)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const signed = await createStorageSignedUploadUrl(BUCKET, `your-family/${name}`)
  return NextResponse.json({ ok: true, signedUrl: signed.signedUrl, path: signed.path })
}
