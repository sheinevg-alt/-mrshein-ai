import { NextResponse } from 'next/server'
import { getApiModelsTask } from '@/lib/server/apimodels'
import { supabaseFetch } from '@/lib/server/supabase'
import { telegramApi } from '@/lib/server/telegram-bot'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId') || ''
  if (!jobId) return NextResponse.json({ ok: false, error: 'JOB_ID_REQUIRED' }, { status: 400 })

  const historyResponse = await supabaseFetch(
    `generation_history?select=id,telegram_id,status,title,result_url,result_metadata,provider&id=eq.${encodeURIComponent(jobId)}&limit=1`,
  )
  const rows = historyResponse.ok ? await historyResponse.json() : []
  const job = rows?.[0]
  if (!job || job.provider !== 'apimodels') {
    return NextResponse.json({ ok: false, error: 'JOB_NOT_FOUND' }, { status: 404 })
  }

  const taskId = String(job.result_metadata?.apimodels_task_id || '')
  if (!taskId) return NextResponse.json({ ok: false, error: 'TASK_ID_MISSING' }, { status: 409 })

  try {
    const task = await getApiModelsTask(taskId)
    const state = String(task.state || '').toLowerCase()

    if (state === 'completed' || state === 'succeeded' || state === 'success') {
      const resultUrl = String(task.resultUrls?.[0] || '')
      if (!resultUrl) throw new Error('APIMODELS_OUTPUT_MISSING')

      const metadata = {
        ...(job.result_metadata || {}),
        apimodels_status: state,
        apimodels_usage: task.usage || null,
      }

      if (job.status !== 'completed' || job.result_url !== resultUrl) {
        await supabaseFetch(`generation_history?id=eq.${job.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            result_url: resultUrl,
            completed_at: new Date().toISOString(),
            result_metadata: metadata,
            updated_at: new Date().toISOString(),
          }),
        })
      }

      if (!job.result_metadata?.telegram_notified_at) {
        const botResponse = await supabaseFetch(
          `bot_users?select=chat_id,language_code,notifications_enabled&telegram_id=eq.${job.telegram_id}&limit=1`,
        )
        const botUsers = botResponse.ok ? await botResponse.json() : []
        const botUser = botUsers?.[0]

        if (botUser?.notifications_enabled !== false && botUser?.chat_id) {
          const ru = String(botUser.language_code || '').toLowerCase().startsWith('ru')
          const appUrl = `${url.origin}/?work=${encodeURIComponent(job.id)}`
          await telegramApi('sendMessage', {
            chat_id: botUser.chat_id,
            text: ru
              ? '✅ <b>Ваше видео готово</b>\n\nОткройте Shein One, чтобы посмотреть результат.'
              : '✅ <b>Your video is ready</b>\n\nOpen Shein One to view the result.',
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[{
                text: ru ? 'Посмотреть видео' : 'View video',
                web_app: { url: appUrl },
              }]],
            },
          })

          await supabaseFetch(`generation_history?id=eq.${job.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              result_metadata: { ...metadata, telegram_notified_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            }),
          })
        }
      }

      return NextResponse.json({ ok: true, status: 'completed' })
    }

    if (state === 'failed' || state === 'error' || state === 'canceled' || state === 'cancelled') {
      const technicalCode = [task.failureCode, task.error].filter(Boolean).join(': ') || `APIMODELS_${state.toUpperCase()}`
      await supabaseFetch(`generation_history?id=eq.${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_code: technicalCode.slice(0, 240),
          failed_at: new Date().toISOString(),
          result_metadata: {
            ...(job.result_metadata || {}),
            apimodels_status: state,
            apimodels_error: task.error || null,
            apimodels_fail_code: task.failureCode || null,
            apimodels_fail_message: task.error || null,
            apimodels_retryable: typeof task.retryable === 'boolean' ? task.retryable : null,
            apimodels_usage: task.usage || null,
          },
          updated_at: new Date().toISOString(),
        }),
      })
      return NextResponse.json({ ok: true, status: 'failed' })
    }

    return NextResponse.json({ ok: true, status: state || 'processing' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CALLBACK_STATUS_FAILED'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
