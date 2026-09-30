import { NextResponse } from 'next/server'
import { getRunwayTask } from '@/lib/server/runway'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId') || ''
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

  const historyResponse = await supabaseFetch(
    `generation_history?select=id,telegram_id,status,token_cost,result_url,provider,model,error_code,result_metadata,refunded_at&id=eq.${encodeURIComponent(jobId)}&telegram_id=eq.${user.id}&limit=1`,
  )
  const rows = historyResponse.ok ? await historyResponse.json() : []
  const job = rows?.[0]
  if (!job) return NextResponse.json({ error: 'Generation not found' }, { status: 404 })

  if (job.status === 'completed') return NextResponse.json({ ok: true, status: 'completed', jobId: job.id, resultUrl: job.result_url })
  if (job.status === 'failed') return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: job.error_code || 'GENERATION_FAILED' })

  const taskId = String(job.result_metadata?.runway_task_id || '')
  if (!taskId) return NextResponse.json({ ok: true, status: job.status || 'processing', jobId: job.id })

  try {
    const task = await getRunwayTask(taskId)
    const status = String(task.status || '').toUpperCase()

    if (status === 'SUCCEEDED') {
      const resultUrl = Array.isArray(task.output) ? String(task.output[0] || '') : ''
      if (!resultUrl) throw new Error('RUNWAY_OUTPUT_MISSING')

      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
          result_metadata: { ...(job.result_metadata || {}), runway_status: status, runway_cost_credits: task.cost ?? null },
          updated_at: new Date().toISOString(),
        }),
      })
      return NextResponse.json({ ok: true, status: 'completed', jobId: job.id, resultUrl, progress: 1 })
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      let tokenBalance: number | null = null
      if (!job.refunded_at && Number(job.token_cost || 0) > 0) {
        const refund = await rpc('refund_tokens', {
          p_telegram_id: user.id,
          p_amount: Number(job.token_cost || 0),
          p_reference: `runway-${status.toLowerCase()}:${job.id}`,
        })
        if (refund.ok) tokenBalance = Number(await refund.json())
      }

      const code = String(task.failureCode || task.failure || `RUNWAY_${status}`).slice(0, 240)
      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_code: code,
          failed_at: new Date().toISOString(),
          refunded_at: job.refunded_at || new Date().toISOString(),
          result_metadata: { ...(job.result_metadata || {}), runway_status: status },
          updated_at: new Date().toISOString(),
        }),
      })
      return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: code, tokenBalance, tokensRefunded: Number(job.token_cost || 0) })
    }

    return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, progress: typeof task.progress === 'number' ? task.progress : null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RUNWAY_STATUS_FAILED'
    return NextResponse.json({ ok: false, status: 'processing', jobId: job.id, transientError: message }, { status: 202 })
  }
}
