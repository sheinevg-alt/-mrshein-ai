import { NextResponse } from 'next/server'
import { telegramApi } from '@/lib/server/telegram-bot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const me = await telegramApi('getMe', {})
    return NextResponse.json({
      ok: true,
      username: me?.username || null,
      name: me?.first_name || null,
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
