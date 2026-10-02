import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { deleteStorageObjects, hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const response = await supabaseFetch('rpc/admin_expired_generation_input_paths', {
    method: 'POST',
    body: JSON.stringify({ p_limit: 500 }),
  })
  if (!response.ok) return NextResponse.json({ error: 'Could not list expired media' }, { status: 500 })

  const rows = await response.json()
  const paths = (Array.isArray(rows) ? rows : []).map((row: any) => String(row.name || '')).filter(Boolean)
  const bytes = (Array.isArray(rows) ? rows : []).reduce((sum: number, row: any) => sum + Number(row.size_bytes || 0), 0)

  if (!paths.length) return NextResponse.json({ ok: true, deleted: 0, freedBytes: 0 })

  const deleted = await deleteStorageObjects('generation-inputs', paths)
  return NextResponse.json({ ok: true, deleted: deleted.deleted, freedBytes: bytes })
}
