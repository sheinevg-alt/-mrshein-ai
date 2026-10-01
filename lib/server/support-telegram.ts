import 'server-only'

import { hasDatabase, supabaseFetch } from './supabase'

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

type TelegramMessage = {
  message_id: number
  message_thread_id?: number
  text?: string
  caption?: string
  chat: { id: number; type?: string; title?: string; is_forum?: boolean }
  from?: TelegramUser & { is_bot?: boolean }
}

type SupportBotConfig = {
  bot_token: string
  webhook_secret: string
  operator_chat_id?: number | null
  operator_setup_code?: string | null
  bot_username?: string | null
}

export async function getSupportBotConfig(): Promise<SupportBotConfig> {
  const envToken = process.env.SUPPORT_TELEGRAM_BOT_TOKEN
  const envSecret = process.env.SUPPORT_TELEGRAM_WEBHOOK_SECRET
  const envChatId = process.env.SUPPORT_OPERATOR_CHAT_ID

  if (envToken && envSecret) {
    return {
      bot_token: envToken,
      webhook_secret: envSecret,
      operator_chat_id: envChatId ? Number(envChatId) : null,
      operator_setup_code: null,
      bot_username: null,
    }
  }

  if (!hasDatabase()) throw new Error('Banana Zero Care is not configured')

  const response = await supabaseFetch(
    'support_bot_config?select=bot_token,webhook_secret,operator_chat_id,operator_setup_code,bot_username&id=eq.banana-zero-care&limit=1',
  )
  if (!response.ok) throw new Error('Could not read Banana Zero Care config')
  const row = (await response.json())?.[0]
  if (!row?.bot_token || !row?.webhook_secret) throw new Error('Banana Zero Care config is incomplete')
  return row
}

export async function isSupportReady() {
  try {
    const config = await getSupportBotConfig()
    return Boolean(config.bot_token && config.webhook_secret && config.operator_chat_id)
  } catch {
    return false
  }
}

export async function supportTelegramApi(method: string, payload: Record<string, unknown>) {
  const config = await getSupportBotConfig()
  const response = await fetch(`https://api.telegram.org/bot${config.bot_token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram API ${method} failed`)
  }
  return data.result
}

async function operatorChatId() {
  const config = await getSupportBotConfig()
  if (!config.operator_chat_id) throw new Error('SUPPORT_OPERATOR_CHAT_ID is not configured')
  return String(config.operator_chat_id)
}

export async function completeOperatorSetup(chatId: number, setupCode: string, chatIsForum?: boolean) {
  if (!hasDatabase()) throw new Error('Supabase is required')
  const config = await getSupportBotConfig()

  if (!config.operator_setup_code || setupCode.trim() !== String(config.operator_setup_code).trim()) {
    return { ok: false as const, reason: 'INVALID_CODE' }
  }

  if (!chatIsForum) {
    return { ok: false as const, reason: 'TOPICS_REQUIRED' }
  }

  const response = await supabaseFetch('support_bot_config?id=eq.banana-zero-care', {
    method: 'PATCH',
    body: JSON.stringify({
      operator_chat_id: chatId,
      operator_setup_code: null,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) throw new Error('Could not save operator chat')

  return { ok: true as const }
}

export async function saveSupportBotUsername(username: string) {
  if (!hasDatabase()) return
  await supabaseFetch('support_bot_config?id=eq.banana-zero-care', {
    method: 'PATCH',
    body: JSON.stringify({
      bot_username: username,
      updated_at: new Date().toISOString(),
    }),
  })
}

function displayName(user: TelegramUser) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || (user.username ? `@${user.username}` : `User ${user.id}`)
}

function topicName(user: TelegramUser) {
  const suffix = user.username ? ` · @${user.username}` : ''
  return `👤 ${displayName(user)}${suffix}`.slice(0, 120)
}

async function getThreadByUser(telegramId: number) {
  if (!hasDatabase()) return null
  const response = await supabaseFetch(
    `support_chat_threads?select=telegram_id,user_chat_id,operator_thread_id,first_name,last_name,username,language_code&telegram_id=eq.${telegramId}&limit=1`,
  )
  if (!response.ok) return null
  return (await response.json())?.[0] || null
}

async function getThreadByOperatorThread(threadId: number) {
  if (!hasDatabase()) return null
  const response = await supabaseFetch(
    `support_chat_threads?select=telegram_id,user_chat_id,operator_thread_id,first_name,last_name,username,language_code&operator_thread_id=eq.${threadId}&limit=1`,
  )
  if (!response.ok) return null
  return (await response.json())?.[0] || null
}

async function saveThread(user: TelegramUser, userChatId: number, operatorThreadId: number) {
  if (!hasDatabase()) return
  const existing = await getThreadByUser(user.id)
  const body = {
    user_chat_id: userChatId,
    operator_thread_id: operatorThreadId,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    language_code: user.language_code ?? null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await supabaseFetch(`support_chat_threads?telegram_id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return
  }

  await supabaseFetch('support_chat_threads', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: user.id,
      ...body,
    }),
  })
}

export async function ensureSupportThread(user: TelegramUser, userChatId = user.id) {
  const existing = await getThreadByUser(user.id)
  if (existing?.operator_thread_id) {
    if (
      existing.user_chat_id !== userChatId ||
      existing.username !== user.username ||
      existing.first_name !== user.first_name ||
      existing.last_name !== user.last_name ||
      existing.language_code !== user.language_code
    ) {
      await saveThread(user, userChatId, Number(existing.operator_thread_id))
    }
    return Number(existing.operator_thread_id)
  }

  const chatId = await operatorChatId()
  const created = await supportTelegramApi('createForumTopic', {
    chat_id: chatId,
    name: topicName(user),
  })
  const threadId = Number(created.message_thread_id)
  await saveThread(user, userChatId, threadId)

  await supportTelegramApi('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: [
      '<b>Banana Zero Care</b>',
      '',
      `Клиент: ${escapeHtml(displayName(user))}`,
      user.username ? `Username: @${escapeHtml(user.username)}` : null,
      `Telegram ID: <code>${user.id}</code>`,
      user.language_code ? `Язык: ${escapeHtml(user.language_code)}` : null,
      '',
      'Отвечайте прямо в этой теме. Ответ уйдёт клиенту от имени Banana Zero Care.',
    ].filter(Boolean).join('\n'),
    parse_mode: 'HTML',
  })

  return threadId
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function messageSummary(message: TelegramMessage) {
  if (message.text) return message.text
  if (message.caption) return message.caption
  return '[Медиа-сообщение]'
}

async function logMessage(
  telegramId: number,
  direction: 'user' | 'operator',
  message: TelegramMessage,
  operatorThreadId?: number,
) {
  if (!hasDatabase()) return
  await supabaseFetch('support_messages', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: telegramId,
      direction,
      text: messageSummary(message),
      telegram_message_id: message.message_id,
      operator_thread_id: operatorThreadId ?? null,
    }),
  })
}

export function supportWelcomeText(languageCode?: string | null) {
  if (languageCode?.toLowerCase().startsWith('ru')) {
    return [
      '👋 <b>Служба заботы Banana Zero</b>',
      '',
      'Напишите сюда вопрос по оплате, генерации или работе сервиса.',
      'Сообщение увидит команда Banana Zero, а ответ придёт прямо в этот чат.',
    ].join('\n')
  }

  return [
    '👋 <b>Banana Zero Care</b>',
    '',
    'Send us your question about billing, generations, or the service.',
    'The Banana Zero team will reply to you right here.',
  ].join('\n')
}

export async function handlePrivateSupportMessage(message: TelegramMessage) {
  const user = message.from
  if (!user?.id) return

  const threadId = await ensureSupportThread(user, message.chat.id)
  const chatId = await operatorChatId()

  await supportTelegramApi('copyMessage', {
    chat_id: chatId,
    from_chat_id: message.chat.id,
    message_id: message.message_id,
    message_thread_id: threadId,
  })

  await logMessage(user.id, 'user', message, threadId)
}

export async function handleOperatorSupportMessage(message: TelegramMessage) {
  const configuredChatId = await operatorChatId().catch(() => null)
  if (!configuredChatId || String(message.chat.id) !== configuredChatId) return false
  if (!message.message_thread_id || message.from?.is_bot) return true

  const thread = await getThreadByOperatorThread(message.message_thread_id)
  if (!thread?.telegram_id) return true

  const telegramId = Number(thread.telegram_id)
  const userChatId = Number(thread.user_chat_id || thread.telegram_id)

  try {
    await supportTelegramApi('copyMessage', {
      chat_id: userChatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    })
  } catch {
    // A Mini App user may not have started the Care bot yet.
  }

  if (hasDatabase()) {
    const openResponse = await supabaseFetch(
      `support_tickets?select=id&telegram_id=eq.${telegramId}&status=eq.open&order=created_at.desc&limit=1`,
    )
    if (openResponse.ok) {
      const ticket = (await openResponse.json())?.[0]
      if (ticket?.id) {
        await supabaseFetch(`support_tickets?id=eq.${encodeURIComponent(ticket.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'answered',
            admin_reply: messageSummary(message),
            updated_at: new Date().toISOString(),
          }),
        })
      }
    }
  }

  await logMessage(telegramId, 'operator', message, message.message_thread_id)
  return true
}

export async function notifyOperatorAboutMiniAppTicket(ticket: any) {
  if (!(await isSupportReady())) return

  const user: TelegramUser = {
    id: Number(ticket.telegram_id),
    first_name: ticket.first_name ?? undefined,
    last_name: ticket.last_name ?? undefined,
    username: ticket.username ?? undefined,
    language_code: ticket.language_code ?? undefined,
  }

  const threadId = await ensureSupportThread(user, user.id)
  const chatId = await operatorChatId()

  await supportTelegramApi('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: [
      '🆕 <b>Обращение из Mini App</b>',
      '',
      `Тема: <b>${escapeHtml(String(ticket.topic || 'other'))}</b>`,
      '',
      escapeHtml(String(ticket.message || '')),
      '',
      `Ticket: <code>${escapeHtml(String(ticket.id || ''))}</code>`,
    ].join('\n'),
    parse_mode: 'HTML',
  })
}
