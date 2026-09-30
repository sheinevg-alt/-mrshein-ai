import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/app-config'
import { requireAdmin } from '@/lib/server/admin-auth'
import { telegramApi } from '@/lib/server/telegram-bot'

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || APP_CONFIG.appUrl).replace(/\/$/, '')
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const payload: Record<string, unknown> = {
    url: `${appUrl}/api/telegram/webhook`,
    allowed_updates: ['message'],
    drop_pending_updates: false,
  }
  if (secret) payload.secret_token = secret

  try {
    const result = await telegramApi('setWebhook', payload)
    return NextResponse.json({ ok: true, result, webhook: `${appUrl}/api/telegram/webhook` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Telegram setup failed' }, { status: 500 })
  }
}
