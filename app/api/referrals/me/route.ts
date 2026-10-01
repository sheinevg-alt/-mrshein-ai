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

  const [profileResponse, balanceResponse, referredResponse, commissionsResponse, usersResponse, payoutsResponse] = await Promise.all([
    supabaseFetch(`referral_profiles?select=referral_code,referral_rate,referred_by,attributed_at&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_wallet_balances?select=available_rub,pending_rub&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_profiles?select=telegram_id&referred_by=eq.${user.id}`),
    supabaseFetch(`referral_commissions?select=commission_rub,status,gross_amount_rub,created_at,referred_telegram_id&referrer_telegram_id=eq.${user.id}&order=created_at.desc&limit=50`),
    supabaseFetch('app_users?select=telegram_id,first_name,last_name,username'),
    supabaseFetch(`referral_payout_requests?select=id,payout_method,amount_rub,status,requested_at,processed_at&telegram_id=eq.${user.id}&order=requested_at.desc&limit=20`),
  ])

  const profile = profileResponse.ok ? (await profileResponse.json())?.[0] : null
  const balance = balanceResponse.ok ? (await balanceResponse.json())?.[0] : null
  const referred = referredResponse.ok ? await referredResponse.json() : []
  const commissions = commissionsResponse.ok ? await commissionsResponse.json() : []
  const users = usersResponse.ok ? await usersResponse.json() : []
  const payouts = payoutsResponse.ok ? await payoutsResponse.json() : []
  const userMap = new Map((users || []).map((item: any) => [String(item.telegram_id), item]))

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

  const reservedPayoutRub = (payouts || [])
    .filter((item: any) => item.status === 'pending' || item.status === 'approved')
    .reduce((sum: number, item: any) => sum + Number(item.amount_rub || 0), 0)

  return NextResponse.json({
    referralCode,
    referralLink,
    commissionPct: Math.round(Number(profile?.referral_rate || 0.2) * 100),
    invitedCount: Array.isArray(referred) ? referred.length : 0,
    availableRub: Math.max(0, Number(balance?.available_rub || 0) - reservedPayoutRub),
    reservedPayoutRub: Number(reservedPayoutRub.toFixed(2)),
    payouts: Array.isArray(payouts) ? payouts : [],
    pendingRub: Number(balance?.pending_rub || 0),
    totalEarnedRub: Number(totalEarned.toFixed(2)),
    referredRevenueRub: Number(referredRevenue.toFixed(2)),
    commissions: Array.isArray(commissions) ? commissions.slice(0, 20).map((item: any) => {
      const referred: any = userMap.get(String(item.referred_telegram_id)) || {}
      return {
        grossAmountRub: Number(item.gross_amount_rub || 0),
        commissionRub: Number(item.commission_rub || 0),
        status: item.status,
        createdAt: item.created_at,
        referredName: [referred.first_name, referred.last_name].filter(Boolean).join(' ') || referred.username || `ID ${item.referred_telegram_id}`,
        referredUsername: referred.username || null,
      }
    }) : [],
  })
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '')
  const amountRub = Number(body?.amountRub)
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
  }

  if (action === 'request_payout') {
    const method = String(body?.method || '')
    const destination = String(body?.destination || '').trim().slice(0, 500)
    if (!['card', 'crypto'].includes(method) || !destination) {
      return NextResponse.json({ error: 'INVALID_PAYOUT_DATA' }, { status: 400 })
    }
    const response = await rpc('request_referral_payout', {
      p_telegram_id: user.id,
      p_method: method,
      p_amount_rub: amountRub,
      p_destination: destination,
    })
    const raw = await response.text()
    if (!response.ok) {
      const insufficient = raw.includes('INSUFFICIENT_REFERRAL_BALANCE')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_REFERRAL_BALANCE' : 'PAYOUT_REQUEST_FAILED' }, { status: insufficient ? 402 : 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action !== 'convert_to_tokens' && action !== 'gift_tokens') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const response = action === 'gift_tokens'
    ? await rpc('gift_referral_balance_as_tokens', {
        p_sender_telegram_id: user.id,
        p_recipient: String(body?.recipient || ''),
        p_amount_rub: amountRub,
      })
    : await rpc('convert_referral_rub_to_tokens', {
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
    action,
    tokensAdded: Number(result?.tokens_added || 0),
    rubSpent: Number(result?.rub_spent || 0),
    rubBalance: Number(result?.rub_balance || 0),
    recipientTelegramId: result?.recipient_telegram_id ? Number(result.recipient_telegram_id) : null,
  })
}
