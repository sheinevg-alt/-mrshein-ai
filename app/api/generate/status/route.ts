import { NextResponse } from 'next/server'
import { getApiModelsTask } from '@/lib/server/apimodels'
import { getBytePlusTask } from '@/lib/server/byteplus'
import { getRunwayTask } from '@/lib/server/runway'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

async function failAndRefund(job: any, userId: number, code: string, metadata: Record<string, unknown> = {}) {
  let tokenBalance: number | null = null
  if (!job.refunded_at && Number(job.token_cost || 0) > 0) {
    const refund = await rpc('refund_tokens', {
      p_telegram_id: userId,
      p_amount: Number(job.token_cost || 0),
      p_reference: `provider-failed:${job.id}`,
    })
    if (refund.ok) tokenBalance = Number(await refund.json())
  }

  await supabaseFetch(`generation_history?id=eq.${job.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'failed',
      error_code: code.slice(0, 240),
      failed_at: new Date().toISOString(),
      refunded_at: job.refunded_at || new Date().toISOString(),
      result_metadata: { ...(job.result_metadata || {}), ...metadata },
      updated_at: new Date().toISOString(),
    }),
  })

  return { tokenBalance, tokensRefunded: Number(job.token_cost || 0) }
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
  if (job.status === 'failed') return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: 'GENERATION_FAILED' })

  const apiModelsTaskId = String(job.result_metadata?.apimodels_task_id || '')
  if (apiModelsTaskId) {
    try {
      const task = await getApiModelsTask(apiModelsTaskId)
      const status = String(task.state || '').toLowerCase()

      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const resultUrl = String(task.resultUrls?.[0] || '')
        if (!resultUrl) throw new Error('APIMODELS_OUTPUT_MISSING')

        await supabaseFetch(`generation_history?id=eq.${job.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            result_url: resultUrl,
            completed_at: new Date().toISOString(),
            result_metadata: {
              ...(job.result_metadata || {}),
              apimodels_status: status,
              apimodels_usage: task.usage || null,
            },
            updated_at: new Date().toISOString(),
          }),
        })
        return NextResponse.json({ ok: true, status: 'completed', jobId: job.id, resultUrl, progress: 1 })
      }

      if (status === 'failed' || status === 'error' || status === 'canceled' || status === 'cancelled') {
        const technicalCode = [task.failureCode, task.error].filter(Boolean).join(': ') || `APIMODELS_${status.toUpperCase()}`
        const refund = await failAndRefund(job, user.id, technicalCode, {
          apimodels_status: status,
          apimodels_error: task.error || null,
          apimodels_fail_code: task.failureCode || null,
          apimodels_fail_message: task.error || null,
          apimodels_retryable: typeof task.retryable === 'boolean' ? task.retryable : null,
          apimodels_usage: task.usage || null,
        })
        return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: 'GENERATION_FAILED', retryable: task.retryable === true, ...refund })
      }

      return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, progress: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'APIMODELS_STATUS_FAILED'
      return NextResponse.json({ ok: false, status: 'processing', jobId: job.id, transientError: message }, { status: 202 })
    }
  }

  const bytePlusTaskId = String(job.result_metadata?.byteplus_task_id || '')
  if (bytePlusTaskId) {
    try {
      const task = await getBytePlusTask(bytePlusTaskId)
      const status = String(task.status || '').toLowerCase()

      if (status === 'succeeded') {
        const resultUrl = String(task.content?.video_url || '')
        if (!resultUrl) throw new Error('BYTEPLUS_OUTPUT_MISSING')

        await supabaseFetch(`generation_history?id=eq.${job.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            result_url: resultUrl,
            completed_at: new Date().toISOString(),
            result_metadata: {
              ...(job.result_metadata || {}),
              byteplus_status: status,
              byteplus_usage: task.usage || null,
              byteplus_resolution: task.resolution || null,
            },
            updated_at: new Date().toISOString(),
          }),
        })
        return NextResponse.json({ ok: true, status: 'completed', jobId: job.id, resultUrl, progress: 1 })
      }

      if (status === 'failed' || status === 'expired') {
        const code = String(task.error?.code || task.error?.message || `BYTEPLUS_${status.toUpperCase()}`)
        const refund = await failAndRefund(job, user.id, code, {
          byteplus_status: status,
          byteplus_error: task.error || null,
          byteplus_usage: task.usage || null,
        })
        return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: 'GENERATION_FAILED', ...refund })
      }

      return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, progress: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'BYTEPLUS_STATUS_FAILED'
      return NextResponse.json({ ok: false, status: 'processing', jobId: job.id, transientError: message }, { status: 202 })
    }
  }

  const runwayTaskId = String(job.result_metadata?.runway_task_id || '')
  if (!runwayTaskId) return NextResponse.json({ ok: true, status: job.status || 'processing', jobId: job.id })

  try {
    const task = await getRunwayTask(runwayTaskId)
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
      const code = String(task.failureCode || task.failure || `RUNWAY_${status}`).slice(0, 240)
      const refund = await failAndRefund(job, user.id, code, { runway_status: status })
      return NextResponse.json({ ok: false, status: 'failed', jobId: job.id, error: 'GENERATION_FAILED', ...refund })
    }

    return NextResponse.json({ ok: true, status: 'processing', jobId: job.id, progress: typeof task.progress === 'number' ? task.progress : null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RUNWAY_STATUS_FAILED'
    return NextResponse.json({ ok: false, status: 'processing', jobId: job.id, transientError: message }, { status: 202 })
  }
}
