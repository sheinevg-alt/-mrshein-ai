import 'server-only'

import { supabaseFetch } from './supabase'

type ClosedBetaConfig = {
  enabled?: boolean
  allowed_telegram_ids?: Array<number | string>
}

export async function hasAppAccess(telegramId: number) {
  try {
    const response = await supabaseFetch(
      'app_settings?select=value&key=eq.closed_beta_access&limit=1',
    )
    if (!response.ok) return false

    const rows = await response.json()
    const config = (rows?.[0]?.value || {}) as ClosedBetaConfig
    if (config.enabled !== true) return true

    const allowed = Array.isArray(config.allowed_telegram_ids)
      ? config.allowed_telegram_ids.map((value) => Number(value))
      : []

    return allowed.includes(Number(telegramId))
  } catch {
    return false
  }
}
