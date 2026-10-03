import { NextResponse } from 'next/server'
import { registerBotUser, telegramApi, welcomeText } from '@/lib/server/telegram-bot'
import { APP_CONFIG } from '@/lib/app-config'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

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
        const payload = text.split(/\s+/, 2)[1] || ''
        if (hasDatabase() && message.from?.id) {
          await supabaseFetch('rpc/ensure_referral_profile', {
            method: 'POST',
            body: JSON.stringify({ p_telegram_id: message.from.id, p_preferred_code: null }),
          })
          if (payload.startsWith('ref_')) {
            const code = payload.slice(4).trim()
            if (code) {
              await supabaseFetch('rpc/apply_referral_attribution', {
                method: 'POST',
                body: JSON.stringify({ p_telegram_id: message.from.id, p_referral_code: code }),
              })
            }
          }
        }

        const appUrl = APP_CONFIG.appUrl.replace(/\/$/, '')
        await telegramApi('sendMessage', {
          chat_id: message.chat.id,
          text: welcomeText(message.from?.language_code),
          reply_markup: {
            inline_keyboard: [
              [{
                text: 'Создать контент',
                web_app: { url: appUrl },
              }],
              [{
                text: '🌐 BananaZero.ru',
                url: APP_CONFIG.website,
              }],
            ],
          },
        })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
