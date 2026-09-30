import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

function failureType(row: any): 'temporary' | 'input' | 'provider' {
  if (row?.result_metadata?.apimodels_retryable === true) return 'temporary'
  const text = [
    row?.error_code,
    row?.result_metadata?.apimodels_fail_code,
    row?.result_metadata?.apimodels_fail_message,
  ].filter(Boolean).join(' ').toLowerCase()

  if (/input|reference|file|format|duration|resolution|unsupported|invalid|image|video/.test(text)) return 'input'
  return 'provider'
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ history: [] })

  const response = await supabaseFetch(
    `generation_history?select=id,type,title,status,created_at,failed_at,result_url,error_code,provider,model,source_id,result_metadata&telegram_id=eq.${user.id}&order=created_at.desc&limit=50`,
  )
  if (!response.ok) return NextResponse.json({ history: [] })
  const rows = await response.json()
  return NextResponse.json({
    history: rows.map((row: any) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      failedAt: row.failed_at || null,
      resultUrl: row.result_url || null,
      error: row.status === 'failed' ? 'GENERATION_FAILED' : null,
      failureType: row.status === 'failed' ? failureType(row) : null,
      retryable: row.status === 'failed' ? row?.result_metadata?.apimodels_retryable === true : false,
      provider: row.provider || null,
      model: row.model || null,
      sourceId: row.source_id || null,
    })),
  })
}
