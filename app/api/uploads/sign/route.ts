import { randomUUID } from 'node:crypto'
import { hasAppAccess } from '@/lib/server/access-control'
import { NextResponse } from 'next/server'
import { createStorageSignedUploadUrl, hasDatabase } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

const BUCKET = 'generation-inputs'
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_AUDIO_BYTES = 15 * 1024 * 1024

const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav'])

function extensionFor(contentType: string) {
  if (contentType === 'video/quicktime') return 'mov'
  if (contentType === 'video/mp4') return 'mp4'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/heic') return 'heic'
  if (contentType === 'image/heif') return 'heif'
  if (contentType === 'audio/mpeg') return 'mp3'
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') return 'wav'
  return 'jpg'
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  if (!(await hasAppAccess(user.id))) return NextResponse.json({ error: 'CLOSED_BETA' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const contentType = String(body?.contentType || '').toLowerCase()
  const size = Number(body?.size || 0)
  const isVideo = VIDEO_TYPES.has(contentType)
  const isImage = IMAGE_TYPES.has(contentType)
  const isAudio = AUDIO_TYPES.has(contentType)

  if (!isVideo && !isImage && !isAudio) {
    return NextResponse.json({ error: 'UNSUPPORTED_INPUT_TYPE' }, { status: 400 })
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES
  if (!Number.isFinite(size) || size <= 0 || size > maxBytes) {
    return NextResponse.json({ error: isVideo ? 'VIDEO_TOO_LARGE' : isAudio ? 'AUDIO_TOO_LARGE' : 'IMAGE_TOO_LARGE' }, { status: 413 })
  }

  const folder = isVideo ? 'videos' : isAudio ? 'audios' : 'images'
  const path = `${user.id}/${folder}/${Date.now()}-${randomUUID()}.${extensionFor(contentType)}`
  try {
    const signed = await createStorageSignedUploadUrl(BUCKET, path)
    return NextResponse.json({ ok: true, bucket: BUCKET, path, signedUrl: signed.signedUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STORAGE_SIGN_UPLOAD_FAILED'
    return NextResponse.json({ error: 'STORAGE_SIGN_UPLOAD_FAILED', details: message }, { status: 500 })
  }
}
