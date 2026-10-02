import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const response = await supabaseFetch('announcements?select=*&order=created_at.desc&limit=100')
  return NextResponse.json({ announcements: response.ok ? await response.json() : [] }, { status: response.ok ? 200 : 500 })
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const kind = ['info','price','model','maintenance','promo'].includes(String(body.kind)) ? String(body.kind) : 'info'
  const titleRu = String(body.titleRu || '').trim().slice(0, 180)
  const titleEn = String(body.titleEn || titleRu).trim().slice(0, 180)
  const bodyRu = String(body.bodyRu || '').trim().slice(0, 2000)
  const bodyEn = String(body.bodyEn || bodyRu).trim().slice(0, 2000)
  const linkUrl = String(body.linkUrl || '').trim().slice(0, 500) || null
  const publish = body.publish !== false
  if (!titleRu || !bodyRu) return NextResponse.json({ error: 'TITLE_AND_BODY_REQUIRED' }, { status: 400 })

  const response = await supabaseFetch('announcements', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      kind,
      title_ru: titleRu,
      title_en: titleEn || titleRu,
      body_ru: bodyRu,
      body_en: bodyEn || bodyRu,
      link_url: linkUrl,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) return NextResponse.json({ error: 'ANNOUNCEMENT_CREATE_FAILED' }, { status: 500 })
  const rows = await response.json()
  return NextResponse.json({ ok: true, announcement: rows?.[0] || null })
}
