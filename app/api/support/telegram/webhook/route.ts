import { NextResponse } from 'next/server'
import {
  ensureSupportThread,
  handleOperatorSupportMessage,
  handlePrivateSupportMessage,
  supportTelegramApi,
  supportWelcomeText,
} from '@/lib/server/support-telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'Banana Zero Care',
    configured: Boolean(
      process.env.SUPPORT_TELEGRAM_BOT_TOKEN &&
      process.env.SUPPORT_OPERATOR_CHAT_ID &&
      process.env.SUPPORT_TELEGRAM_WEBHOOK_SECRET
    ),
  })
}

export async function POST(request: Request) {
  const expectedSecret = process.env.SUPPORT_TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  try {
    const update = await request.json()
    const message = update?.message
    if (!message) return NextResponse.json({ ok: true })

    if (message.chat?.type !== 'private' && String(message.text || '').trim() === '/chatid') {
      await supportTelegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: `Chat ID: <code>${message.chat.id}</code>`,
        parse_mode: 'HTML',
      })
      return NextResponse.json({ ok: true })
    }

    if (message.chat?.type === 'private') {
      const text = String(message.text || '')
      if (text === '/start' || text.startsWith('/start ')) {
        if (message.from?.id) {
          await ensureSupportThread(message.from, message.chat.id)
        }
        await supportTelegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: supportWelcomeText(message.from?.language_code),
          parse_mode: 'HTML',
        })
      } else {
        await handlePrivateSupportMessage(message)
      }
      return NextResponse.json({ ok: true })
    }

    await handleOperatorSupportMessage(message)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Banana Zero Care webhook error', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
