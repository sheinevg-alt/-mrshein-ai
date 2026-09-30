import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const response = await supabaseFetch('knowledge_articles?select=*&order=sort_order.asc,created_at.asc')
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  return NextResponse.json({ articles: await response.json() })
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  if (!body?.title_en || !body?.body_en || !body?.category) return NextResponse.json({ error: 'title_en, body_en and category are required' }, { status: 400 })
  const slugBase = String(body.slug || body.title_en).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'
  const row = {
    slug: `${slugBase}-${randomUUID().slice(0, 5)}`,
    category: String(body.category),
    title_en: String(body.title_en),
    title_ru: body.title_ru ? String(body.title_ru) : null,
    body_en: String(body.body_en),
    body_ru: body.body_ru ? String(body.body_ru) : null,
    published: body.published !== false,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    updated_at: new Date().toISOString(),
  }
  const response = await supabaseFetch('knowledge_articles', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  return NextResponse.json({ article: (await response.json())?.[0] })
}
