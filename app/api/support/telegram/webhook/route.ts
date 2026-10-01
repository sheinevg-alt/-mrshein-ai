import { NextResponse } from 'next/server'
import {
  completeOperatorSetup,
  getSupportBotConfig,
  handleOperatorSupportMessage,
  handlePrivateSupportMessage,
  isSupportReady,
  supportTelegramApi,
  supportWelcomeText,
} from '@/lib/server/support-telegram'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ready = await isSupportReady()
  let username: string | null = null
  try {
    username = (await getSupportBotConfig()).bot_username || null
  } catch {
    // Status endpoint should stay readable even while setup is incomplete.
  }

  return NextResponse.json({
    ok: true,
    service: 'Banana Zero Care',
    configured: ready,
    bot: username ? `@${username}` : null,
  })
}

export async function POST(request: Request) {
  let expectedSecret = ''
  try {
    expectedSecret = (await getSupportBotConfig()).webhook_secret
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  if (request.headers.get('x-telegram-bot-api-secret-token') !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  try {
    const update = await request.json()
    const message = update?.message
    if (!message) return NextResponse.json({ ok: true })

    const text = String(message.text || '').trim()

    if (message.chat?.type !== 'private' && text.startsWith('/setoperator')) {
      const setupCode = text.split(/\s+/)[1] || ''
      const result = await completeOperatorSetup(
        Number(message.chat.id),
        setupCode,
        Boolean(message.chat?.is_forum),
      )

      if (!result.ok) {
        const responseText = result.reason === 'TOPICS_REQUIRED'
          ? 'Сначала включите «Темы» (Topics) в этой группе, затем повторите команду.'
          : 'Неверный или уже использованный код подключения.'
        await supportTelegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: responseText,
        })
        return NextResponse.json({ ok: true })
      }

      await supportTelegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: [
          '✅ <b>Banana Zero Care подключён</b>',
          '',
          'Эта группа теперь операторская.',
          'Для каждого клиента будет автоматически создаваться отдельная тема.',
          'Отвечайте внутри темы — клиент получит сообщение от имени Banana Zero Care.',
        ].join('\n'),
        parse_mode: 'HTML',
      })
      return NextResponse.json({ ok: true })
    }

    if (message.chat?.type !== 'private' && text === '/chatid') {
      await supportTelegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: `Chat ID: <code>${message.chat.id}</code>`,
        parse_mode: 'HTML',
      })
      return NextResponse.json({ ok: true })
    }

    if (message.chat?.type === 'private') {
      if (text === '/start' || text.startsWith('/start ')) {
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
