import { NextResponse } from 'next/server'
import { getSupportBotConfig, supportTelegramApi } from '@/lib/server/support-telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getSupportBotConfig()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mrshein-ai-v3.vercel.app').replace(/\/$/, '')
    const webhookUrl = `${appUrl}/api/support/telegram/webhook`
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
      secret_token: config.webhook_secret,
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
      operatorChatConfigured: Boolean(config.operator_chat_id),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Setup failed',
    }, { status: 500 })
  }
}
