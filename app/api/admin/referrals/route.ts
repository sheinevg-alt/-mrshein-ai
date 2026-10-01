import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  await supabaseFetch('rpc/release_due_referral_commissions', { method: 'POST', body: '{}' })

  const [profilesResponse, commissionsResponse, balancesResponse, usersResponse] = await Promise.all([
    supabaseFetch('referral_profiles?select=telegram_id,referral_code,referred_by,referral_rate,attributed_at,created_at&order=created_at.asc'),
    supabaseFetch('referral_commissions?select=referrer_telegram_id,referred_telegram_id,gross_amount_rub,commission_rub,status,created_at&order=created_at.desc'),
    supabaseFetch('referral_wallet_balances?select=telegram_id,available_rub,pending_rub'),
    supabaseFetch('app_users?select=telegram_id,first_name,last_name,username,token_balance,created_at,last_seen_at'),
  ])

  const profiles = profilesResponse.ok ? await profilesResponse.json() : []
  const commissions = commissionsResponse.ok ? await commissionsResponse.json() : []
  const balances = balancesResponse.ok ? await balancesResponse.json() : []
  const users = usersResponse.ok ? await usersResponse.json() : []

  const userMap = new Map((users || []).map((user: any) => [String(user.telegram_id), user]))
  const balanceMap = new Map((balances || []).map((row: any) => [String(row.telegram_id), row]))

  const rows = (profiles || []).map((profile: any) => {
    const id = String(profile.telegram_id)
    const user: any = userMap.get(id) || {}
    const balance: any = balanceMap.get(id) || {}
    const direct = (profiles || []).filter((item: any) => String(item.referred_by || '') === id)
    const earned = (commissions || []).filter((item: any) => String(item.referrer_telegram_id) === id && item.status !== 'reversed')
    const salesRub = earned.reduce((sum: number, item: any) => sum + Number(item.gross_amount_rub || 0), 0)
    const earnedRub = earned.reduce((sum: number, item: any) => sum + Number(item.commission_rub || 0), 0)

    return {
      telegramId: Number(profile.telegram_id),
      referralCode: profile.referral_code,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `ID ${profile.telegram_id}`,
      username: user.username || null,
      tokenBalance: Number(user.token_balance || 0),
      invitedCount: direct.length,
      salesRub: Number(salesRub.toFixed(2)),
      earnedRub: Number(earnedRub.toFixed(2)),
      availableRub: Number(balance.available_rub || 0),
      pendingRub: Number(balance.pending_rub || 0),
      referredBy: profile.referred_by ? Number(profile.referred_by) : null,
      createdAt: profile.created_at,
      lastSeenAt: user.last_seen_at || null,
    }
  })

  const totalSalesRub = (commissions || [])
    .filter((item: any) => item.status !== 'reversed')
    .reduce((sum: number, item: any) => sum + Number(item.gross_amount_rub || 0), 0)
  const totalCommissionRub = (commissions || [])
    .filter((item: any) => item.status !== 'reversed')
    .reduce((sum: number, item: any) => sum + Number(item.commission_rub || 0), 0)

  return NextResponse.json({
    summary: {
      partners: rows.length,
      referredUsers: (profiles || []).filter((item: any) => item.referred_by).length,
      totalSalesRub: Number(totalSalesRub.toFixed(2)),
      totalCommissionRub: Number(totalCommissionRub.toFixed(2)),
      availableRub: Number((balances || []).reduce((sum: number, row: any) => sum + Number(row.available_rub || 0), 0).toFixed(2)),
      pendingRub: Number((balances || []).reduce((sum: number, row: any) => sum + Number(row.pending_rub || 0), 0).toFixed(2)),
    },
    referrals: rows,
  })
}
