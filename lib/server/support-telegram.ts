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
  chat: { id: number; type?: string }
  from?: TelegramUser & { is_bot?: boolean }
}

function supportToken() {
  const token = process.env.SUPPORT_TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('SUPPORT_TELEGRAM_BOT_TOKEN is not configured')
  return token
}

function operatorChatId() {
  const id = process.env.SUPPORT_OPERATOR_CHAT_ID
  if (!id) throw new Error('SUPPORT_OPERATOR_CHAT_ID is not configured')
  return id
}

export function hasSupportTelegram() {
  return Boolean(
    process.env.SUPPORT_TELEGRAM_BOT_TOKEN &&
    process.env.SUPPORT_OPERATOR_CHAT_ID,
  )
}

export async function supportTelegramApi(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${supportToken()}/${method}`, {
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

  const created = await supportTelegramApi('createForumTopic', {
    chat_id: operatorChatId(),
    name: topicName(user),
  })
  const threadId = Number(created.message_thread_id)
  await saveThread(user, userChatId, threadId)

  await supportTelegramApi('sendMessage', {
    chat_id: operatorChatId(),
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

  await supportTelegramApi('copyMessage', {
    chat_id: operatorChatId(),
    from_chat_id: message.chat.id,
    message_id: message.message_id,
    message_thread_id: threadId,
  })

  await logMessage(user.id, 'user', message, threadId)
}

export async function handleOperatorSupportMessage(message: TelegramMessage) {
  if (String(message.chat.id) !== String(operatorChatId())) return false
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
  if (!hasSupportTelegram()) return

  const user: TelegramUser = {
    id: Number(ticket.telegram_id),
    first_name: ticket.first_name ?? undefined,
    last_name: ticket.last_name ?? undefined,
    username: ticket.username ?? undefined,
    language_code: ticket.language_code ?? undefined,
  }

  const threadId = await ensureSupportThread(user, user.id)

  await supportTelegramApi('sendMessage', {
    chat_id: operatorChatId(),
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
