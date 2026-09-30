import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ history: [] })

  const response = await supabaseFetch(
    `generation_history?select=id,type,title,status,created_at&telegram_id=eq.${user.id}&order=created_at.desc&limit=50`,
  )
  if (!response.ok) return NextResponse.json({ history: [] })
  const rows = await response.json()
  return NextResponse.json({
    history: rows.map((row: any) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
    })),
  })
}
