import { NextResponse } from 'next/server'
import { APP_CONFIG } from '@/lib/app-config'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { saveBotUser } from '@/lib/server/telegram-bot'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const userRecord = {
    telegram_id: user.id,
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    language_code: user.language_code ?? null,
    last_seen_at: new Date().toISOString(),
  }

  const existingProfileResponse = await supabaseFetch(`app_users?select=telegram_id&telegram_id=eq.${user.id}&limit=1`)
  const existingProfiles = existingProfileResponse.ok ? await existingProfileResponse.json() : []

  await Promise.all([
    existingProfiles?.length
      ? supabaseFetch(`app_users?telegram_id=eq.${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify(userRecord),
        })
      : supabaseFetch('app_users', {
          method: 'POST',
          body: JSON.stringify(userRecord),
        }),
    saveBotUser({
      chatId: user.id,
      telegramId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      languageCode: user.language_code,
    }),
  ])

  const [profileResponse, botResponse] = await Promise.all([
    supabaseFetch(`app_users?select=token_balance&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`bot_users?select=notifications_enabled&telegram_id=eq.${user.id}&limit=1`),
  ])
  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const bots = botResponse.ok ? await botResponse.json() : []

  return NextResponse.json({
    tokenBalance: profiles?.[0]?.token_balance ?? APP_CONFIG.defaultTokenBalance,
    notificationsEnabled: bots?.[0]?.notifications_enabled ?? true,
  })
}
