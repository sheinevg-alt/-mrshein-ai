import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

const TABLES = [
  'app_users',
  'generation_history',
  'token_ledger',
  'payment_orders',
  'referral_profiles',
  'referral_commissions',
  'referral_payout_requests',
  'trends',
  'knowledge_articles',
  'support_tickets',
  'admin_audit_log',
] as const

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const snapshot: Record<string, unknown> = {}
  for (const table of TABLES) {
    const response = await supabaseFetch(`${table}?select=*`)
    snapshot[table] = response.ok ? await response.json() : { error: `Could not export ${table}` }
  }

  return new NextResponse(JSON.stringify({
    product: 'Banana Zero',
    exportedAt: new Date().toISOString(),
    version: 1,
    data: snapshot,
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="banana-zero-snapshot-${new Date().toISOString().slice(0,10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
