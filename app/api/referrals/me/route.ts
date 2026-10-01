import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { telegramApi } from '@/lib/server/telegram-bot'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

function parseJson(text: string) {
  try { return text ? JSON.parse(text) : null } catch { return null }
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  await rpc('ensure_referral_profile', { p_telegram_id: user.id, p_preferred_code: null })
  await rpc('release_due_referral_commissions', {})

  const [profileResponse, balanceResponse, referredResponse, commissionsResponse, payoutsResponse] = await Promise.all([
    supabaseFetch(`referral_profiles?select=referral_code,referral_rate,referred_by,attributed_at&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_wallet_balances?select=available_rub,pending_rub&telegram_id=eq.${user.id}&limit=1`),
    supabaseFetch(`referral_profiles?select=telegram_id,attributed_at&referred_by=eq.${user.id}&order=attributed_at.desc.nullslast`),
    supabaseFetch(`referral_commissions?select=id,referred_telegram_id,commission_rub,status,gross_amount_rub,created_at,available_at&referrer_telegram_id=eq.${user.id}&order=created_at.desc&limit=100`),
    supabaseFetch(`referral_payout_requests?select=id,payout_method,amount_rub,status,requested_at,processed_at&telegram_id=eq.${user.id}&order=requested_at.desc&limit=20`),
  ])

  const profile = profileResponse.ok ? (await profileResponse.json())?.[0] : null
  const balance = balanceResponse.ok ? (await balanceResponse.json())?.[0] : null
  const referred = referredResponse.ok ? await referredResponse.json() : []
  const commissions = commissionsResponse.ok ? await commissionsResponse.json() : []
  const payouts = payoutsResponse.ok ? await payoutsResponse.json() : []

  const referredIds = (Array.isArray(referred) ? referred : [])
    .map((row: any) => Number(row.telegram_id))
    .filter((id: number) => Number.isFinite(id))

  let referredUsers: any[] = []
  let purchases: any[] = []
  if (referredIds.length > 0) {
    const ids = referredIds.join(',')
    const [usersResponse, purchasesResponse] = await Promise.all([
      supabaseFetch(`app_users?select=telegram_id,first_name,last_name,username,created_at,last_seen_at&telegram_id=in.(${ids})`),
      supabaseFetch(`payment_orders?select=id,telegram_id,amount,status,purchase_type,paid_at,created_at&status=eq.succeeded&telegram_id=in.(${ids})&order=paid_at.desc.nullslast&limit=100`),
    ])
    referredUsers = usersResponse.ok ? await usersResponse.json() : []
    purchases = purchasesResponse.ok ? await purchasesResponse.json() : []
  }

  let botUsername = ''
  try {
    const me = await telegramApi('getMe', {})
    botUsername = String(me?.username || '')
  } catch {
    // Dashboard still works even if Telegram is temporarily unavailable.
  }

  const referralCode = String(profile?.referral_code || '')
  const referralLink = botUsername && referralCode
    ? `https://t.me/${botUsername}?start=ref_${encodeURIComponent(referralCode)}`
    : null

  const activeCommissions = (Array.isArray(commissions) ? commissions : []).filter((item: any) => item.status !== 'reversed')
  const totalEarned = activeCommissions.reduce((sum: number, item: any) => sum + Number(item.commission_rub || 0), 0)
  const referredRevenue = activeCommissions.reduce((sum: number, item: any) => sum + Number(item.gross_amount_rub || 0), 0)
  const reservedPayouts = (Array.isArray(payouts) ? payouts : [])
    .filter((item: any) => item.status === 'pending' || item.status === 'approved')
    .reduce((sum: number, item: any) => sum + Number(item.amount_rub || 0), 0)
  const spendableRub = Math.max(0, Number(balance?.available_rub || 0) - reservedPayouts)

  const userMap = new Map(referredUsers.map((row: any) => [String(row.telegram_id), row]))
  const clients = referredIds.map((telegramId: number) => {
    const person: any = userMap.get(String(telegramId)) || {}
    const clientPurchases = purchases.filter((purchase: any) => Number(purchase.telegram_id) === telegramId)
    const clientCommissions = activeCommissions.filter((commission: any) => Number(commission.referred_telegram_id) === telegramId)
    const purchasesRub = clientPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.amount || 0), 0)
    const earnedRub = clientCommissions.reduce((sum: number, commission: any) => sum + Number(commission.commission_rub || 0), 0)
    return {
      telegramId,
      name: [person.first_name, person.last_name].filter(Boolean).join(' ') || person.username || `ID ${telegramId}`,
      username: person.username || null,
      joinedAt: person.created_at || null,
      lastSeenAt: person.last_seen_at || null,
      purchasesCount: clientPurchases.length,
      purchasesRub: Number(purchasesRub.toFixed(2)),
      earnedRub: Number(earnedRub.toFixed(2)),
      lastPurchaseAt: clientPurchases[0]?.paid_at || clientPurchases[0]?.created_at || null,
    }
  })

  return NextResponse.json({
    referralCode,
    referralLink,
    commissionPct: Math.round(Number(profile?.referral_rate || 0.2) * 100),
    invitedCount: referredIds.length,
    availableRub: Number(spendableRub.toFixed(2)),
    pendingRub: Number(balance?.pending_rub || 0),
    reservedPayoutRub: Number(reservedPayouts.toFixed(2)),
    totalEarnedRub: Number(totalEarned.toFixed(2)),
    referredRevenueRub: Number(referredRevenue.toFixed(2)),
    clients,
    purchases: purchases.slice(0, 30).map((purchase: any) => ({
      id: purchase.id,
      telegramId: Number(purchase.telegram_id),
      amountRub: Number(purchase.amount || 0),
      purchaseType: purchase.purchase_type || null,
      paidAt: purchase.paid_at || purchase.created_at,
    })),
    payouts: Array.isArray(payouts) ? payouts : [],
    commissions: activeCommissions.slice(0, 30),
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

  if (action === 'convert_to_tokens') {
    const response = await rpc('convert_referral_rub_to_tokens', {
      p_telegram_id: user.id,
      p_amount_rub: amountRub,
    })
    const raw = await response.text()
    const data = parseJson(raw)
    if (!response.ok) {
      const insufficient = raw.includes('INSUFFICIENT_REFERRAL_BALANCE')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_REFERRAL_BALANCE' : 'CONVERSION_FAILED' }, { status: insufficient ? 402 : 500 })
    }
    const result = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
      ok: true,
      tokensAdded: Number(result?.tokens_added || 0),
      rubSpent: Number(result?.rub_spent || 0),
      rubBalance: Number(result?.rub_balance || 0),
    })
  }

  if (action === 'gift_tokens') {
    const recipientInput = String(body?.recipient || '').trim()
    if (!recipientInput) return NextResponse.json({ error: 'RECIPIENT_REQUIRED' }, { status: 400 })

    let recipientId = Number(recipientInput)
    if (!Number.isFinite(recipientId)) {
      const username = recipientInput.replace(/^@/, '').trim()
      if (!username) return NextResponse.json({ error: 'RECIPIENT_REQUIRED' }, { status: 400 })
      const response = await supabaseFetch(`app_users?select=telegram_id&username=ilike.${encodeURIComponent(username)}&limit=1`)
      const rows = response.ok ? await response.json() : []
      recipientId = Number(rows?.[0]?.telegram_id)
    }
    if (!Number.isFinite(recipientId)) return NextResponse.json({ error: 'RECIPIENT_NOT_FOUND' }, { status: 404 })

    const response = await rpc('gift_referral_balance_as_tokens', {
      p_sender_telegram_id: user.id,
      p_recipient_telegram_id: recipientId,
      p_amount_rub: amountRub,
    })
    const raw = await response.text()
    const data = parseJson(raw)
    if (!response.ok) {
      const error = raw.includes('RECIPIENT_NOT_FOUND') ? 'RECIPIENT_NOT_FOUND'
        : raw.includes('INSUFFICIENT_REFERRAL_BALANCE') ? 'INSUFFICIENT_REFERRAL_BALANCE'
          : 'GIFT_FAILED'
      return NextResponse.json({ error }, { status: error === 'RECIPIENT_NOT_FOUND' ? 404 : error === 'INSUFFICIENT_REFERRAL_BALANCE' ? 402 : 500 })
    }
    const result = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ ok: true, tokensAdded: Number(result?.tokens_added || 0), rubSpent: Number(result?.rub_spent || 0), recipientTelegramId: recipientId })
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
    const data = parseJson(raw)
    if (!response.ok) {
      const insufficient = raw.includes('INSUFFICIENT_REFERRAL_BALANCE')
      return NextResponse.json({ error: insufficient ? 'INSUFFICIENT_REFERRAL_BALANCE' : 'PAYOUT_REQUEST_FAILED' }, { status: insufficient ? 402 : 500 })
    }
    return NextResponse.json({ ok: true, requestId: typeof data === 'string' ? data : data })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
