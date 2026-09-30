import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  delete body.id
  body.updated_at = new Date().toISOString()
  const response = await supabaseFetch(`knowledge_articles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  return NextResponse.json({ article: (await response.json())?.[0] })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const { id } = await context.params
  const response = await supabaseFetch(`knowledge_articles?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  return NextResponse.json({ ok: response.ok }, { status: response.ok ? 200 : 500 })
}
