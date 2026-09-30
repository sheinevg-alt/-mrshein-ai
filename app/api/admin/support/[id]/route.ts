import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { telegramApi } from '@/lib/server/telegram-bot'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const { id } = await context.params
  const body = await request.json().catch(() => ({}))
  const existingResponse = await supabaseFetch(`support_tickets?select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
  const existing = existingResponse.ok ? (await existingResponse.json())?.[0] : null
  if (!existing) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const reply = typeof body.admin_reply === 'string' ? body.admin_reply.trim() : undefined
  const status = ['open', 'answered', 'closed'].includes(body.status) ? body.status : (reply ? 'answered' : existing.status)
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (reply !== undefined) patch.admin_reply = reply

  const response = await supabaseFetch(`support_tickets?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })

  let telegram = null
  if (reply && body.send_telegram !== false) {
    try {
      const ru = String(existing.language_code || '').toLowerCase().startsWith('ru')
      telegram = await telegramApi('sendMessage', {
        chat_id: existing.telegram_id,
        text: ru ? `💬 Ответ службы заботы\n\n${reply}` : `💬 Care Team reply\n\n${reply}`,
      })
    } catch (error) {
      telegram = { error: error instanceof Error ? error.message : 'Telegram send failed' }
    }
  }

  return NextResponse.json({ ticket: (await response.json())?.[0], telegram })
}
