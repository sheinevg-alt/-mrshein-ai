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
  const base = (title || 'Shein-One-result')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'Shein-One-result'
  return `${base}.${ext}`
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId') || ''
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

  const historyResponse = await supabaseFetch(
    `generation_history?select=id,title,status,result_url&telegram_id=eq.${user.id}&id=eq.${encodeURIComponent(jobId)}&limit=1`,
  )
  const rows = historyResponse.ok ? await historyResponse.json() : []
  const job = rows?.[0]
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

  const upstream = await fetch(resultUrl, { cache: 'no-store' })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not download result' }, { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  const filename = safeFilename(contentType, String(job.title || 'Shein-One-result'))
  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Download-Filename', filename)
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)

  return new Response(upstream.body, { status: 200, headers })
}
