import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { broadcastNewTrend } from '@/lib/server/telegram-bot'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const notify = Boolean(body.notify_users)
  delete body.notify_users
  delete body.id
  body.updated_at = new Date().toISOString()

  const response = await supabaseFetch(`trends?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  const updated = (await response.json())?.[0]
  let notification = null
  if (updated?.published && notify) {
    try { notification = await broadcastNewTrend(id) } catch (error) { notification = { error: error instanceof Error ? error.message : 'Broadcast failed' } }
  }
  return NextResponse.json({ trend: updated, notification })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const { id } = await context.params
  const response = await supabaseFetch(`trends?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  return NextResponse.json({ ok: response.ok }, { status: response.ok ? 200 : 500 })
}
