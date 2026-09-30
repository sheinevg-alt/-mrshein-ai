import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createStorageSignedUploadUrl, hasDatabase } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const BUCKET = 'generation-inputs'
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

function extensionFor(contentType: string) {
  return contentType === 'video/quicktime' ? 'mov' : 'mp4'
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const contentType = String(body?.contentType || '').toLowerCase()
  const size = Number(body?.size || 0)

  if (!['video/mp4', 'video/quicktime'].includes(contentType)) {
    return NextResponse.json({ error: 'UNSUPPORTED_VIDEO_TYPE' }, { status: 400 })
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'VIDEO_TOO_LARGE' }, { status: 413 })
  }

  const path = `${user.id}/${Date.now()}-${randomUUID()}.${extensionFor(contentType)}`
  try {
    const signed = await createStorageSignedUploadUrl(BUCKET, path)
    return NextResponse.json({ ok: true, bucket: BUCKET, path, signedUrl: signed.signedUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STORAGE_SIGN_UPLOAD_FAILED'
    return NextResponse.json({ error: 'STORAGE_SIGN_UPLOAD_FAILED', details: message }, { status: 500 })
  }
}
