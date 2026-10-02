import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

async function json(path: string) {
  const response = await supabaseFetch(path)
  if (!response.ok) return []
  return response.json()
}

export async function GET(request: Request, context: { params: Promise<{ telegramId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { telegramId: raw } = await context.params
  const telegramId = Number(raw)
  if (!Number.isSafeInteger(telegramId)) return NextResponse.json({ error: 'Invalid Telegram ID' }, { status: 400 })
  const id = encodeURIComponent(String(telegramId))

  const [users, generations, ledger, payments, support, referralProfiles, audit] = await Promise.all([
    json(`app_users?select=*&telegram_id=eq.${id}&limit=1`),
    json(`generation_history?select=*&telegram_id=eq.${id}&order=created_at.desc&limit=200`),
    json(`token_ledger?select=*&telegram_id=eq.${id}&order=created_at.desc&limit=300`),
    json(`payment_orders?select=*&telegram_id=eq.${id}&order=created_at.desc&limit=100`),
    json(`support_tickets?select=*&telegram_id=eq.${id}&order=created_at.desc&limit=100`),
    json(`referral_profiles?select=*&telegram_id=eq.${id}&limit=1`),
    json(`admin_audit_log?select=*&subject_id=eq.${id}&order=created_at.desc&limit=100`),
  ])

  const user = users?.[0]
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const completed = generations.filter((row: any) => row.status === 'completed')
  const failed = generations.filter((row: any) => row.status === 'failed')
  const generationDebits = ledger
    .filter((row: any) => row.event_type === 'generation')
    .reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount || 0)), 0)
  const refunds = ledger
    .filter((row: any) => row.event_type === 'refund')
    .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)
  const paidRub = payments
    .filter((row: any) => row.status === 'succeeded')
    .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    user,
    referralProfile: referralProfiles?.[0] || null,
    summary: {
      generations: generations.length,
      completed: completed.length,
      failed: failed.length,
      tokensDebitedForGenerations: generationDebits,
      tokensRefunded: refunds,
      paidRub: Number(paidRub.toFixed(2)),
    },
    generations,
    ledger,
    payments,
    support,
    audit,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
