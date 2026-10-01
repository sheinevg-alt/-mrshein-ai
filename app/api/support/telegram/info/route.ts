import { NextResponse } from 'next/server'
import { getSupportBotConfig, supportTelegramApi } from '@/lib/server/support-telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await getSupportBotConfig()
    const [bot, webhook] = await Promise.all([
      supportTelegramApi('getMe', {}),
      supportTelegramApi('getWebhookInfo', {}),
    ])

    return NextResponse.json({
      ok: true,
      service: 'Banana Zero Care',
      configured: true,
      bot: bot?.username ? `@${bot.username}` : config.bot_username || null,
      webhook: {
        url: webhook?.url || null,
        pending_update_count: Number(webhook?.pending_update_count || 0),
        last_error_message: webhook?.last_error_message || null,
      },
      operatorChatConfigured: Boolean(config.operator_chat_id),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      service: 'Banana Zero Care',
      configured: false,
      error: error instanceof Error ? error.message : 'Support bot unavailable',
    }, { status: 503 })
  }
}
