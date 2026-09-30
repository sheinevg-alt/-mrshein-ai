import 'server-only'
import { APP_CONFIG } from '@/lib/app-config'
import { hasDatabase, supabaseFetch } from './supabase'

export async function telegramApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok || !data?.ok) throw new Error(data?.description || `Telegram API ${method} failed`)
  return data.result
}

export function welcomeText(languageCode?: string | null) {
  if (languageCode?.toLowerCase().startsWith('ru')) {
    return '👋 Welcome!\n\nСоздавай изображения и видео с AI.\nНажми Generate, чтобы начать.'
  }
  return '👋 Welcome!\n\nCreate images and videos with AI.\nTap Generate to start.'
}

export async function saveBotUser(user: {
  chatId: number
  telegramId: number
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  languageCode?: string | null
}) {
  if (!hasDatabase()) return
  const existingResponse = await supabaseFetch(`bot_users?select=chat_id&chat_id=eq.${user.chatId}&limit=1`)
  const existing = existingResponse.ok ? await existingResponse.json() : []
  const common = {
    telegram_id: user.telegramId,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    username: user.username ?? null,
    language_code: user.languageCode ?? null,
    last_seen_at: new Date().toISOString(),
  }

  if (existing?.length) {
    await supabaseFetch(`bot_users?chat_id=eq.${user.chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(common),
    })
  } else {
    await supabaseFetch('bot_users', {
      method: 'POST',
      body: JSON.stringify({ chat_id: user.chatId, ...common, notifications_enabled: true }),
    })
  }
}

export async function registerBotUser(message: any) {
  const from = message?.from
  const chatId = message?.chat?.id
  if (!chatId) return
  await saveBotUser({
    chatId,
    telegramId: from?.id ?? chatId,
    firstName: from?.first_name,
    lastName: from?.last_name,
    username: from?.username,
    languageCode: from?.language_code,
  })
}

export async function broadcastNewTrend(trendId: string) {
  if (!hasDatabase()) throw new Error('Supabase is required for broadcasts')
  const response = await supabaseFetch('bot_users?select=chat_id,language_code&notifications_enabled=eq.true')
  if (!response.ok) throw new Error(`Could not read bot users: ${response.status}`)
  const users = await response.json()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || APP_CONFIG.appUrl).replace(/\/$/, '')
  const targetUrl = `${appUrl}/?trend=${encodeURIComponent(trendId)}`

  let delivered = 0
  for (const user of users) {
    const ru = String(user.language_code || '').toLowerCase().startsWith('ru')
    const text = ru
      ? '🔥 <b>New Trend</b>\n\nНовый тренд уже доступен.\nБудь одним из первых.'
      : '🔥 <b>New Trend</b>\n\nA new trend is now available.\nBe one of the first.'
    try {
      await telegramApi('sendMessage', {
        chat_id: user.chat_id,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: 'Try Trend', web_app: { url: targetUrl } }]] },
      })
      delivered += 1
    } catch {
      // Continue so one blocked/deleted chat does not stop the broadcast.
    }
  }
  return { delivered, total: users.length }
}
