import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

export type VerifiedTelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export function verifyTelegramInitData(initData: string): VerifiedTelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || !initData) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const authDate = Number(params.get('auth_date') || 0)
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const left = Buffer.from(computed, 'hex')
  const right = Buffer.from(hash, 'hex')
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  try {
    const userRaw = params.get('user')
    if (!userRaw) return null
    const user = JSON.parse(userRaw)
    return typeof user?.id === 'number' ? user : null
  } catch {
    return null
  }
}
