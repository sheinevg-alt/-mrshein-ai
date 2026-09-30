import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const response = await supabaseFetch('support_tickets?select=*&order=created_at.desc&limit=100')
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  return NextResponse.json({ tickets: await response.json() })
}
