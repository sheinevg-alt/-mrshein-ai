import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

async function json(path: string) {
  const response = await supabaseFetch(path)
  return response.ok ? response.json() : []
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const [users, profiles, wallets] = await Promise.all([
    json('app_users?select=telegram_id,first_name,last_name,username,language_code,token_balance,plan_code,plan_expires_at,created_at,last_seen_at&order=last_seen_at.desc&limit=500'),
    json('referral_profiles?select=telegram_id,referral_code,referred_by,referral_rate,created_at&limit=500'),
    json('referral_wallet_balances?select=telegram_id,available_rub,pending_rub&limit=500'),
  ])

  const profileMap = new Map((profiles || []).map((row: any) => [String(row.telegram_id), row]))
  const walletMap = new Map((wallets || []).map((row: any) => [String(row.telegram_id), row]))
  const invitedMap = new Map<string, number>()
  for (const row of profiles || []) {
    if (row.referred_by) {
      const key = String(row.referred_by)
      invitedMap.set(key, (invitedMap.get(key) || 0) + 1)
    }
  }

  return NextResponse.json({
    users: (users || []).map((user: any) => {
      const key = String(user.telegram_id)
      const profile: any = profileMap.get(key) || {}
      const wallet: any = walletMap.get(key) || {}
      return {
        ...user,
        referral_code: profile.referral_code || null,
        referred_by: profile.referred_by || null,
        referral_rate: Number(profile.referral_rate || 0),
        invited_count: invitedMap.get(key) || 0,
        referral_available_rub: Number(wallet.available_rub || 0),
        referral_pending_rub: Number(wallet.pending_rub || 0),
      }
    }),
  })
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const telegramId = Number(body?.telegramId)
  const amount = Math.trunc(Number(body?.amount))
  const note = String(body?.note || '').trim().slice(0, 300)
  const requestId = String(body?.requestId || randomUUID()).slice(0, 120)

  if (!Number.isSafeInteger(telegramId) || !Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
    return NextResponse.json({ error: 'Invalid token adjustment' }, { status: 400 })
  }

  const response = await supabaseFetch('rpc/admin_adjust_tokens', {
    method: 'POST',
    body: JSON.stringify({
      p_telegram_id: telegramId,
      p_amount: amount,
      p_reference: note || (amount > 0 ? 'Creator token grant' : 'Admin token debit'),
      p_actor: 'banana-zero-admin',
      p_idempotency_key: requestId,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    return NextResponse.json({ error: details.includes('INSUFFICIENT_TOKENS') ? 'INSUFFICIENT_TOKENS' : details.includes('USER_NOT_FOUND') ? 'USER_NOT_FOUND' : 'TOKEN_ADJUSTMENT_FAILED' }, { status: 400 })
  }

  const result = await response.json()
  return NextResponse.json({ ok: true, tokenBalance: Number(result || 0) })
}
