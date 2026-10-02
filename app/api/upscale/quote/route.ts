import { NextResponse } from 'next/server'
import { quoteTokens } from '@/lib/server/model-pricing'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const mediaType = String(body?.mediaType || '')
  if (mediaType !== 'video' && mediaType !== 'image') {
    return NextResponse.json({ error: 'INVALID_MEDIA_TYPE' }, { status: 400 })
  }

  if (mediaType === 'video') {
    const duration = Math.max(1, Math.min(120, Number(body?.sourceDuration || 0)))
    const resolution = String(body?.targetResolution || '1080p').toLowerCase()
    if (!['720p', '1080p', '2k', '4k'].includes(resolution)) {
      return NextResponse.json({ error: 'INVALID_TARGET_RESOLUTION' }, { status: 400 })
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      return NextResponse.json({ error: 'SOURCE_DURATION_REQUIRED' }, { status: 400 })
    }
    const q = await quoteTokens({ toolId: 'video-upscale', duration, resolution })
    return NextResponse.json({ ok: true, tokenCost: q.tokenCost })
  }

  const q = await quoteTokens({ toolId: 'image-upscale' })
  return NextResponse.json({ ok: true, tokenCost: q.tokenCost })
}
