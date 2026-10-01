import { NextResponse } from 'next/server'
import { supportTelegramApi } from '@/lib/server/support-telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tokenConfigured = Boolean(process.env.SUPPORT_TELEGRAM_BOT_TOKEN)
  const secret = process.env.SUPPORT_TELEGRAM_WEBHOOK_SECRET

  if (!tokenConfigured || !secret) {
    return NextResponse.json({
      ok: false,
      error: 'Missing SUPPORT_TELEGRAM_BOT_TOKEN or SUPPORT_TELEGRAM_WEBHOOK_SECRET',
    }, { status: 503 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mrshein-ai-v3.vercel.app').replace(/\/$/, '')
  const webhookUrl = `${appUrl}/api/support/telegram/webhook`

  try {
    const bot = await supportTelegramApi('getMe', {})

    await supportTelegramApi('setMyDescription', {
      description: 'Служба заботы Banana Zero. Вопросы по оплате, генерациям и работе сервиса.',
      language_code: 'ru',
    })
    await supportTelegramApi('setMyShortDescription', {
      short_description: 'Служба заботы Banana Zero',
      language_code: 'ru',
    })
    await supportTelegramApi('setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть службу заботы' },
        { command: 'help', description: 'Помощь' },
      ],
      language_code: 'ru',
    })

    await supportTelegramApi('setWebhook', {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    })

    const webhook = await supportTelegramApi('getWebhookInfo', {})

    return NextResponse.json({
      ok: true,
      bot: {
        id: bot.id,
        username: bot.username,
        first_name: bot.first_name,
      },
      webhook: {
        url: webhook.url,
        pending_update_count: webhook.pending_update_count,
        last_error_message: webhook.last_error_message || null,
      },
      operatorChatConfigured: Boolean(process.env.SUPPORT_OPERATOR_CHAT_ID),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Setup failed',
    }, { status: 500 })
  }
}
