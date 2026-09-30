import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ tickets: [] })

  const response = await supabaseFetch(
    `support_tickets?select=id,topic,message,status,admin_reply,created_at,updated_at&telegram_id=eq.${user.id}&order=created_at.desc&limit=20`,
  )
  if (!response.ok) return NextResponse.json({ tickets: [] })
  return NextResponse.json({ tickets: await response.json() })
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Support is not configured yet' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const topic = String(body?.topic || 'other').slice(0, 64)
  const message = String(body?.message || '').trim()
  if (message.length < 3) return NextResponse.json({ error: 'Message is too short' }, { status: 400 })
  if (message.length > 5000) return NextResponse.json({ error: 'Message is too long' }, { status: 400 })

  const response = await supabaseFetch('support_tickets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      telegram_id: user.id,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      language_code: user.language_code ?? null,
      topic,
      message,
      status: 'open',
    }),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  const ticket = (await response.json())?.[0]
  return NextResponse.json({ ticket })
}
