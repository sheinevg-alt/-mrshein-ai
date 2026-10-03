import { NextResponse } from 'next/server'
import { hasAppAccess } from '@/lib/server/access-control'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ enabled: false }, { status: 401 })
  if (!(await hasAppAccess(user.id)) || !hasDatabase()) {
    return NextResponse.json({ enabled: false })
  }

  const response = await supabaseFetch(
    'app_settings?select=value&key=eq.test_checkout_users&limit=1',
  )
  const rows = response.ok ? await response.json() : []
  const config = rows?.[0]?.value || {}
  const ids = Array.isArray(config?.telegram_ids) ? config.telegram_ids.map(Number) : []
  const enabled = config?.enabled === true && ids.includes(Number(user.id))

  return NextResponse.json({
    enabled,
    amountRub: enabled ? Number(config?.amount_rub || 100) : null,
    tokenAmount: enabled ? Number(config?.token_amount || 100) : null,
  })
}
