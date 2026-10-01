import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/app-config'
import { requireAdmin } from '@/lib/server/admin-auth'
import { telegramApi } from '@/lib/server/telegram-bot'

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || APP_CONFIG.appUrl).replace(/\/$/, '')
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET

  try {
    const bot = await telegramApi('getMe', {})

    // Keep the new main bot fully branded/configured from one admin action.
    await telegramApi('setMyName', { name: 'Banana Zero' })
    await telegramApi('setMyDescription', {
      description: 'Banana Zero — создавай изображения и видео с AI.',
      language_code: 'ru',
    })
    await telegramApi('setMyShortDescription', {
      short_description: 'Создавай изображения и видео с AI',
      language_code: 'ru',
    })
    await telegramApi('setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть Banana Zero' },
      ],
      language_code: 'ru',
    })
    await telegramApi('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'Создать контент',
        web_app: { url: appUrl },
      },
    })

    const webhookPayload: Record<string, unknown> = {
      url: `${appUrl}/api/telegram/webhook`,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    }
    if (secret) webhookPayload.secret_token = secret

    await telegramApi('setWebhook', webhookPayload)
    const webhook = await telegramApi('getWebhookInfo', {})

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot?.id || null,
        username: bot?.username || null,
        name: 'Banana Zero',
      },
      webhook: {
        url: webhook?.url || `${appUrl}/api/telegram/webhook`,
        pending_update_count: webhook?.pending_update_count ?? 0,
        last_error_message: webhook?.last_error_message || null,
      },
      appUrl,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Telegram setup failed',
    }, { status: 500 })
  }
}
