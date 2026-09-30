'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ExternalLink, FolderOpen, LoaderCircle, RefreshCw, XCircle } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { useI18n } from '../i18n-provider'
import { useUserState, type HistoryItem } from '../user-provider'

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/Video/') || url.includes('cloudfront.net')
}

function StatusPill({ item, locale }: { item: HistoryItem; locale: 'en' | 'ru' }) {
  if (item.status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="size-3.5" />{locale === 'ru' ? 'Готово' : 'Ready'}
      </span>
    )
  }
  if (item.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
        <XCircle className="size-3.5" />{locale === 'ru' ? 'Ошибка' : 'Failed'}
      </span>
    )
  }
  if (item.status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
        <Clock3 className="size-3.5" />{locale === 'ru' ? 'В очереди' : 'Queued'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
      <LoaderCircle className="size-3.5 animate-spin" />{locale === 'ru' ? 'Генерируется' : 'Generating'}
    </span>
  )
}

export function WorksScreen() {
  const { locale } = useI18n()
  const { history, refreshUser } = useUserState()
  const [refreshing, setRefreshing] = useState(false)

  const activeIdsKey = useMemo(
    () => history.filter((item) => item.status === 'queued' || item.status === 'processing').map((item) => item.id).join('|'),
    [history],
  )

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (!activeIdsKey) return
    const initData = getTelegramInitData()
    if (!initData) return

    const ids = activeIdsKey.split('|').filter(Boolean)
    let cancelled = false
    let running = false

    async function syncJobs() {
      if (running || cancelled) return
      running = true
      try {
        await Promise.all(ids.map((jobId) =>
          fetch(`/api/generate/status?jobId=${encodeURIComponent(jobId)}`, {
            headers: { 'X-Telegram-Init-Data': initData },
            cache: 'no-store',
          }).catch(() => undefined),
        ))
        if (!cancelled) await refreshUser()
      } finally {
        running = false
      }
    }

    void syncJobs()
    const timer = window.setInterval(() => void syncJobs(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeIdsKey, refreshUser])

  async function manualRefresh() {
    haptics.selection()
    setRefreshing(true)
    try {
      const initData = getTelegramInitData()
      if (initData) {
        const active = history.filter((item) => item.status === 'queued' || item.status === 'processing')
        await Promise.all(active.map((item) =>
          fetch(`/api/generate/status?jobId=${encodeURIComponent(item.id)}`, {
            headers: { 'X-Telegram-Init-Data': initData },
            cache: 'no-store',
          }).catch(() => undefined),
        ))
      }
      await refreshUser()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-300">
      <header className="flex items-start justify-between gap-3 pt-4 pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{locale === 'ru' ? 'Мои работы' : 'My works'}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'ru' ? 'Здесь отслеживаются генерации и появляются готовые файлы.' : 'Track generations here and open completed files.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void manualRefresh()}
          disabled={refreshing}
          aria-label={locale === 'ru' ? 'Обновить' : 'Refresh'}
          className="glass flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {history.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
            <FolderOpen className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">{locale === 'ru' ? 'Работ пока нет' : 'No works yet'}</h2>
          <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
            {locale === 'ru' ? 'После нажатия Generate новая задача сразу появится здесь.' : 'After you tap Generate, the new job will appear here immediately.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((item) => {
            const created = new Date(item.createdAt)
            const dateLabel = Number.isNaN(created.getTime())
              ? ''
              : new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }).format(created)

            return (
              <article key={item.id} className="glass overflow-hidden rounded-3xl p-3">
                <div className="flex items-start justify-between gap-3 px-1 py-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{item.title || (locale === 'ru' ? 'Генерация' : 'Generation')}</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{dateLabel}</p>
                  </div>
                  <StatusPill item={item} locale={locale} />
                </div>

                {(item.status === 'queued' || item.status === 'processing') && (
                  <div className="mt-3 rounded-2xl bg-brand-tint/60 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-brand">
                      <LoaderCircle className="size-4 animate-spin" />
                      {locale === 'ru' ? 'Seedance 2.5 создаёт видео…' : 'Seedance 2.5 is creating the video…'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {locale === 'ru' ? 'Можно перейти в другие разделы — статус обновляется здесь.' : 'You can use other sections — status keeps updating here.'}
                    </p>
                  </div>
                )}

                {item.status === 'failed' && (
                  <div className="mt-3 rounded-2xl bg-destructive/8 px-4 py-3">
                    <p className="text-sm font-medium text-destructive">{locale === 'ru' ? 'Генерация не завершилась' : 'Generation failed'}</p>
                    {item.error && <p className="mt-1 break-words text-xs text-muted-foreground">{item.error}</p>}
                  </div>
                )}

                {item.status === 'completed' && item.resultUrl && (
                  <div className="mt-3">
                    <div className="overflow-hidden rounded-2xl border bg-black">
                      {isVideoUrl(item.resultUrl) ? (
                        <video src={item.resultUrl} controls playsInline preload="metadata" className="max-h-[58dvh] w-full object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- generated remote result
                        <img src={item.resultUrl} alt="Generated result" className="w-full object-contain" />
                      )}
                    </div>
                    <a
                      href={item.resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold text-brand transition active:scale-[0.98]"
                    >
                      <ExternalLink className="size-4" />
                      {locale === 'ru' ? 'Открыть готовое видео' : 'Open completed file'}
                    </a>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
