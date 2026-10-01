import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { getApiModelsBalance } from '@/lib/server/apimodels-account'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { MODEL_CATALOG } from '@/lib/model-catalog'

export const dynamic = 'force-dynamic'

async function json(path: string) {
  const response = await supabaseFetch(path)
  return response.ok ? response.json() : []
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const [users, generations, payments, ledger, commissions, payouts] = await Promise.all([
    json('app_users?select=telegram_id,token_balance,created_at,last_seen_at&order=created_at.desc&limit=500'),
    json('generation_history?select=id,telegram_id,title,status,token_cost,provider,model,error_code,result_metadata,created_at,completed_at&order=created_at.desc&limit=100'),
    json('payment_orders?select=id,telegram_id,provider,status,currency,amount,token_amount,payment_method,created_at,paid_at&order=created_at.desc&limit=100'),
    json('token_ledger?select=id,telegram_id,amount,event_type,reference,created_at&order=created_at.desc&limit=100'),
    json('referral_commissions?select=commission_rub,gross_amount_rub,status,created_at&order=created_at.desc&limit=200'),
    json('referral_payout_requests?select=id,telegram_id,amount_rub,status,requested_at&order=requested_at.desc&limit=100'),
  ])

  const now = Date.now()
  const active7d = users.filter((u: any) => now - new Date(u.last_seen_at).getTime() <= 7 * 86400000).length
  const totalTokens = users.reduce((sum: number, u: any) => sum + Number(u.token_balance || 0), 0)
  const paidOrders = payments.filter((p: any) => p.status === 'paid' || p.paid_at)
  const rubRevenue = paidOrders.filter((p: any) => p.currency === 'RUB').reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
  const completed = generations.filter((g: any) => g.status === 'completed').length
  const failed = generations.filter((g: any) => g.status === 'failed').length
  const processing = generations.filter((g: any) => ['queued','processing'].includes(g.status)).length
  const referralCommissionRub = commissions.filter((c: any) => c.status !== 'reversed').reduce((sum: number, c: any) => sum + Number(c.commission_rub || 0), 0)
  const pendingPayoutRub = payouts.filter((p: any) => ['pending','approved'].includes(p.status)).reduce((sum: number, p: any) => sum + Number(p.amount_rub || 0), 0)

  let provider: any = { configured: Boolean(process.env.APIMODELS_API_KEY), balanceUsd: null, error: null }
  if (provider.configured) {
    try {
      const balance = await getApiModelsBalance()
      provider = { configured: true, balanceUsd: balance.balanceUsd, error: null }
    } catch (error) {
      provider = { configured: true, balanceUsd: null, error: error instanceof Error ? error.message : 'Balance unavailable' }
    }
  }

  return NextResponse.json({
    summary: {
      users: users.length,
      active7d,
      totalTokens,
      generations: generations.length,
      completed,
      failed,
      processing,
      rubRevenue: Number(rubRevenue.toFixed(2)),
      referralCommissionRub: Number(referralCommissionRub.toFixed(2)),
      pendingPayoutRub: Number(pendingPayoutRub.toFixed(2)),
    },
    provider,
    models: MODEL_CATALOG,
    recent: {
      generations: generations.slice(0, 20),
      payments: payments.slice(0, 20),
      ledger: ledger.slice(0, 30),
    },
  })
}
