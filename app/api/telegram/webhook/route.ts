import { NextResponse } from 'next/server'
import { registerBotUser, telegramApi, welcomeText } from '@/lib/server/telegram-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  try {
    const update = await request.json()
    const message = update?.message
    if (message) {
      await registerBotUser(message)
      const text = String(message.text || '')
      if (text === '/start' || text.startsWith('/start ')) {
        await telegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: welcomeText(message.from?.language_code),
        })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
