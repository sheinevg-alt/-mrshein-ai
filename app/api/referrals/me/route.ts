import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { telegramApi } from '@/lib/server/telegram-bot'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  await rpc('ensure_referral_profile', { p_telegram_id: user.id, p_preferred_code: null })
  await rpc('release_due_referral_commissions', {})

  const [profileResponse, balanceResponse, referredResponse, commissionsResponse] = await Promise.all([
    supabaseFetch(`referral_profiles?select=referral_code,referral_rate,referred_by,attributed_at&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_wallet_balances?select=available_rub,pending_rub&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_profiles?select=telegram_id&referred_by=eq.${user.id}`),
    supabaseFetch(`referral_commissions?select=commission_rub,status,gross_amount_rub,created_at&referrer_telegram_id=eq.${user.id}&order=created_at.desc&limit=50`),
  ])

  const profile = profileResponse.ok ? (await profileResponse.json())?.[0] : null
  const balance = balanceResponse.ok ? (await balanceResponse.json())?.[0] : null
  const referred = referredResponse.ok ? await referredResponse.json() : []
  const commissions = commissionsResponse.ok ? await commissionsResponse.json() : []

  let botUsername = ''
  try {
    const me = await telegramApi('getMe', {})
    botUsername = String(me?.username || '')
  } catch {
    // Referral dashboard still works; link will be unavailable until Telegram is configured.
  }

  const referralCode = String(profile?.referral_code || '')
  const referralLink = botUsername && referralCode
    ? `https://t.me/${botUsername}?start=ref_${encodeURIComponent(referralCode)}`
    : null

  const totalEarned = (commissions || [])
    .filter((item: any) => item.status !== 'reversed')
    .reduce((sum: number, item: any) => sum + Number(item.commission_rub || 0), 0)

  const referredRevenue = (commissions || [])
    .filter((item: any) => item.status !== 'reversed')
    .reduce((sum: number, item: any) => sum + Number(item.gross_amount_rub || 0), 0)

  return NextResponse.json({
    referralCode,
    referralLink,
    commissionPct: Math.round(Number(profile?.referral_rate || 0.2) * 100),
    invitedCount: Array.isArray(referred) ? referred.length : 0,
    availableRub: Number(balance?.available_rub || 0),
    pendingRub: Number(balance?.pending_rub || 0),
    totalEarnedRub: Number(totalEarned.toFixed(2)),
    referredRevenueRub: Number(referredRevenue.toFixed(2)),
    commissions: Array.isArray(commissions) ? commissions.slice(0, 20) : [],
  })
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  if (body?.action !== 'convert_to_tokens') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const amountRub = Number(body?.amountRub)
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
  }

  const response = await rpc('convert_referral_rub_to_tokens', {
    p_telegram_id: user.id,
    p_amount_rub: amountRub,
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }

  if (!response.ok) {
    const insufficient = raw.includes('INSUFFICIENT_REFERRAL_BALANCE')
    return NextResponse.json(
      { error: insufficient ? 'INSUFFICIENT_REFERRAL_BALANCE' : 'CONVERSION_FAILED' },
      { status: insufficient ? 402 : 500 },
    )
  }

  const result = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    ok: true,
    tokensAdded: Number(result?.tokens_added || 0),
    rubSpent: Number(result?.rub_spent || 0),
    rubBalance: Number(result?.rub_balance || 0),
  })
}
