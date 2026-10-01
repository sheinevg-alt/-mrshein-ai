import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/app-config'
import { telegramApi } from '@/lib/server/telegram-bot'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const me = await telegramApi('getMe', {})
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || APP_CONFIG.appUrl).replace(/\/$/, '')
    const expectedWebhook = `${appUrl}/api/telegram/webhook`
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET

    let webhook = await telegramApi('getWebhookInfo', {})

    const menuButton = await telegramApi('getChatMenuButton', {})
    if (menuButton?.type !== 'web_app' || menuButton?.text !== 'Создать контент' || menuButton?.web_app?.url !== appUrl) {
      await telegramApi('setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'Создать контент',
          web_app: { url: appUrl },
        },
      })
    }

    if (webhook?.url !== expectedWebhook) {
      const payload: Record<string, unknown> = {
        url: expectedWebhook,
        allowed_updates: ['message'],
        drop_pending_updates: false,
      }
      if (secret) payload.secret_token = secret
      await telegramApi('setWebhook', payload)
      webhook = await telegramApi('getWebhookInfo', {})
    }

    return NextResponse.json({
      ok: true,
      username: me?.username || null,
      name: me?.first_name || null,
      webhook: {
        url: webhook?.url || null,
        pending_update_count: webhook?.pending_update_count ?? 0,
        last_error_message: webhook?.last_error_message || null,
      },
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
