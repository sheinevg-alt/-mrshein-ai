import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File is required' }, { status: 400 })
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo) return NextResponse.json({ error: 'Only image or video files are supported' }, { status: 400 })
  const maxSize = isVideo ? 60 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxSize) return NextResponse.json({ error: isVideo ? 'Video is too large' : 'Image is too large' }, { status: 400 })

  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const storageBase = base.replace(/\/$/, '')
  const response = await fetch(`${storageBase}/storage/v1/object/trend-previews/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: await file.arrayBuffer(),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })

  return NextResponse.json({ url: `${storageBase}/storage/v1/object/public/trend-previews/${name}` })
}
