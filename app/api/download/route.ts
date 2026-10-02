import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

function safeFilename(contentType: string, title: string) {
  const ext = contentType.includes('video/webm') ? 'webm'
    : contentType.includes('video/quicktime') ? 'mov'
      : contentType.includes('image/jpeg') ? 'jpg'
        : contentType.includes('image/webp') ? 'webp'
          : contentType.includes('image/') ? 'png'
            : 'mp4'
  const base = (title || 'Banana-Zero-result')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'Banana-Zero-result'
  return `${base}.${ext}`
}

function downloadSecret() {
  return process.env.TELEGRAM_BOT_TOKEN || ''
}

function signDownload(jobId: string, userId: number, exp: number) {
  const secret = downloadSecret()
  if (!secret) return ''
  return createHmac('sha256', secret)
    .update(`${jobId}:${userId}:${exp}`)
    .digest('hex')
}

function verifyDownloadSignature(jobId: string, userId: number, exp: number, signature: string) {
  if (!signature || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = signDownload(jobId, userId, exp)
  if (!expected) return false
  const left = Buffer.from(expected, 'hex')
  const right = Buffer.from(signature, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

async function findJob(jobId: string, userId: number) {
  const historyResponse = await supabaseFetch(
    `generation_history?select=id,title,status,result_url&telegram_id=eq.${userId}&id=eq.${encodeURIComponent(jobId)}&limit=1`,
  )
  const rows = historyResponse.ok ? await historyResponse.json() : []
  return rows?.[0] || null
}

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId') || ''
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

  const prepare = url.searchParams.get('prepare') === '1'

  if (prepare) {
    const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await findJob(jobId, user.id)
    if (!job || job.status !== 'completed' || !job.result_url) {
      return NextResponse.json({ error: 'Result is not ready' }, { status: 404 })
    }

    const resultUrl = String(job.result_url)
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(resultUrl) || resultUrl.includes('/videos/')
    const filename = `Banana-Zero-${isVideo ? 'video' : 'image'}-${jobId.slice(0, 8)}.${isVideo ? 'mp4' : 'png'}`
    const exp = Math.floor(Date.now() / 1000) + 10 * 60
    const sig = signDownload(jobId, user.id, exp)
    if (!sig) return NextResponse.json({ error: 'Download is not configured' }, { status: 503 })

    const downloadUrl = new URL('/api/download', url.origin)
    downloadUrl.searchParams.set('jobId', jobId)
    downloadUrl.searchParams.set('uid', String(user.id))
    downloadUrl.searchParams.set('exp', String(exp))
    downloadUrl.searchParams.set('sig', sig)

    return NextResponse.json({
      ok: true,
      url: downloadUrl.toString(),
      fileName: filename,
      expiresAt: exp,
    })
  }

  let userId: number | null = null
  const signedUserId = Number(url.searchParams.get('uid') || 0)
  const exp = Number(url.searchParams.get('exp') || 0)
  const sig = url.searchParams.get('sig') || ''

  if (signedUserId > 0 && verifyDownloadSignature(jobId, signedUserId, exp, sig)) {
    userId = signedUserId
  } else {
    const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
    if (user) userId = user.id
  }

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await findJob(jobId, userId)
  if (!job || job.status !== 'completed' || !job.result_url) {
    return NextResponse.json({ error: 'Result is not ready' }, { status: 404 })
  }

  let resultUrl: URL
  try {
    resultUrl = new URL(String(job.result_url))
  } catch {
    return NextResponse.json({ error: 'Invalid result URL' }, { status: 500 })
  }
  if (resultUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported result URL' }, { status: 400 })
  }

  const upstream = await fetch(resultUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null)

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not download result' }, { status: 502 })
  }

  const resultHref = resultUrl.toString()
  const isVideoResult = /\.(mp4|webm|mov)(\?|$)/i.test(resultHref) || resultHref.includes('/videos/')
  const upstreamContentType = upstream.headers.get('content-type') || ''
  const contentType = isVideoResult
    ? (resultHref.match(/\.webm(\?|$)/i) ? 'video/webm' : resultHref.match(/\.mov(\?|$)/i) ? 'video/quicktime' : 'video/mp4')
    : (upstreamContentType.startsWith('image/') ? upstreamContentType : 'image/png')
  const filename = safeFilename(contentType, String(job.title || 'Banana-Zero-result'))
  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Access-Control-Allow-Origin', 'https://web.telegram.org')
  headers.set('X-Download-Filename', filename)
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
