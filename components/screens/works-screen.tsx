'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Download, ExternalLink, FolderOpen, LoaderCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { useI18n } from '../i18n-provider'
import { useUserState, type HistoryItem } from '../user-provider'

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/Video/') || url.includes('cloudfront.net') || url.includes('/videos/')
}

function extensionForType(contentType: string, video: boolean) {
  if (contentType.includes('video/webm')) return 'webm'
  if (contentType.includes('video/quicktime')) return 'mov'
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('image/png')) return 'png'
  return video ? 'mp4' : 'png'
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
        <AlertCircle className="size-3.5" />{locale === 'ru' ? 'Не удалось' : 'Failed'}
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

function failureCopy(item: HistoryItem, locale: 'en' | 'ru') {
  if (item.failureType === 'input') {
    return locale === 'ru'
      ? 'Сервис не смог обработать один из исходных файлов. Проверьте референсы и попробуйте ещё раз.'
      : 'The service could not process one of the source files. Check the references and try again.'
  }
  if (item.failureType === 'temporary' || item.retryable) {
    return locale === 'ru'
      ? 'Произошёл временный сбой сервиса. Можно повторить генерацию.'
      : 'The service had a temporary issue. You can retry the generation.'
  }
  return locale === 'ru'
    ? 'Сервис не смог завершить генерацию. Можно попробовать повторить.'
    : 'The service could not finish the generation. You can try again.'
}

export function WorksScreen({ onRepeatGeneration }: { onRepeatGeneration?: (jobId: string) => void }) {
  const { locale } = useI18n()
  const { history, refreshUser, markWorksSeen } = useUserState()
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadErrorId, setDownloadErrorId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryErrorId, setRetryErrorId] = useState<string | null>(null)

  const visibleHistory = useMemo(() => history.filter((item) => {
    if (item.status !== 'failed') return true
    const failed = new Date(item.failedAt || item.createdAt).getTime()
    if (!Number.isFinite(failed)) return false
    return Date.now() - failed < 24 * 60 * 60 * 1000
  }), [history])

  useEffect(() => {
    markWorksSeen()
    void refreshUser()
  }, [markWorksSeen, refreshUser])

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

  async function retryGeneration(item: HistoryItem) {
    const initData = getTelegramInitData()
    if (!initData) return
    setRetryingId(item.id)
    setRetryErrorId(null)
    try {
      const response = await fetch('/api/generate/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ jobId: item.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.ok) throw new Error('RETRY_FAILED')
      haptics.success()
      await refreshUser()
    } catch {
      setRetryErrorId(item.id)
    } finally {
      setRetryingId(null)
    }
  }

  async function downloadResult(item: HistoryItem) {
    const initData = getTelegramInitData()
    if (!initData || !item.resultUrl) return
    setDownloadingId(item.id)
    setDownloadErrorId(null)
    try {
      const response = await fetch(`/api/download?jobId=${encodeURIComponent(item.id)}`, {
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`DOWNLOAD_${response.status}`)

      const blob = await response.blob()
      const video = isVideoUrl(item.resultUrl)
      const ext = extensionForType(response.headers.get('content-type') || blob.type || '', video)
      const filename = `Banana-Zero-${video ? 'video' : 'image'}-${item.id.slice(0, 8)}.${ext}`
      const file = new File([blob], filename, { type: blob.type || response.headers.get('content-type') || undefined })

      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean
        share?: (data: ShareData) => Promise<void>
      }
      const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isAppleMobile && shareNavigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await shareNavigator.share({ files: [file], title: filename })
      } else {
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
      }
      haptics.success()
    } catch {
      setDownloadErrorId(item.id)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="animate-in fade-in duration-300">
      <header className="flex items-start justify-between gap-3 pt-4 pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{locale === 'ru' ? 'Мои работы' : 'My works'}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'ru'
              ? 'Здесь появляются активные, готовые и недавние неудачные генерации. Готовые медиа храните у себя: срок доступности в сервисе ограничен 14 днями.'
              : 'Active, completed, and recent failed generations appear here. Save completed media to your device: in-service availability is limited to 14 days.'}
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

      {visibleHistory.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
            <FolderOpen className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">{locale === 'ru' ? 'Работ пока нет' : 'No works yet'}</h2>
          <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
            {locale === 'ru' ? 'После запуска генерации задача сразу появится здесь.' : 'A new job appears here as soon as generation starts.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleHistory.map((item) => {
            const created = new Date(item.createdAt)
            const dateLabel = Number.isNaN(created.getTime())
              ? ''
              : new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }).format(created)
            const elapsedMinutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000))
            const takingLonger = (item.status === 'queued' || item.status === 'processing') && elapsedMinutes >= 25
            const video = Boolean(item.resultUrl && isVideoUrl(item.resultUrl))

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
                      {takingLonger
                        ? (locale === 'ru' ? 'Генерация занимает дольше обычного…' : 'Generation is taking longer than usual…')
                        : (locale === 'ru' ? 'Создаём результат…' : 'Creating your result…')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {takingLonger
                        ? (locale === 'ru' ? 'Задача активна. Мы продолжаем проверять её статус.' : 'The job is still active. We are continuing to check its status.')
                        : (locale === 'ru' ? 'Обычно 7–25 минут. Можно перейти в другие разделы — мы сообщим, когда всё будет готово.' : 'Usually 7–25 minutes. You can use other sections — we will let you know when it is ready.')}
                    </p>
                  </div>
                )}

                {item.status === 'failed' && (
                  <div className="mt-3 rounded-2xl bg-destructive/8 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                      <AlertCircle className="size-4" />
                      {locale === 'ru' ? 'Не удалось создать результат' : 'Could not create the result'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{failureCopy(item, locale)}</p>
                    <button
                      type="button"
                      onClick={() => void retryGeneration(item)}
                      disabled={retryingId === item.id}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold text-brand transition active:scale-[0.98] disabled:opacity-55"
                    >
                      {retryingId === item.id ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                      {retryingId === item.id
                        ? (locale === 'ru' ? 'Повторяю…' : 'Retrying…')
                        : (locale === 'ru' ? 'Повторить' : 'Retry')}
                    </button>
                    {retryErrorId === item.id && (
                      <p className="mt-2 text-center text-xs text-destructive">
                        {locale === 'ru' ? 'Не удалось повторить автоматически. Откройте инструмент и запустите ещё раз.' : 'Automatic retry failed. Open the tool and start again.'}
                      </p>
                    )}
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      {locale === 'ru' ? 'Запись об ошибке хранится здесь 24 часа.' : 'This failed item stays here for 24 hours.'}
                    </p>
                  </div>
                )}

                {item.status === 'completed' && item.resultUrl && (
                  <div className="mt-3">
                    <div className="overflow-hidden rounded-2xl border bg-black">
                      {video ? (
                        <video src={item.resultUrl} controls playsInline preload="metadata" className="max-h-[58dvh] w-full object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- generated remote result
                        <img src={item.resultUrl} alt="Generated result" className="w-full object-contain" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadResult(item)}
                      disabled={downloadingId === item.id}
                      className="brand-gradient mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-55"
                    >
                      {downloadingId === item.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                      {downloadingId === item.id
                        ? (locale === 'ru' ? 'Подготавливаю…' : 'Preparing…')
                        : video
                          ? (locale === 'ru' ? 'Скачать видео' : 'Download video')
                          : (locale === 'ru' ? 'Скачать изображение' : 'Download image')}
                    </button>
                    <a
                      href={item.resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold text-brand transition active:scale-[0.98]"
                    >
                      <ExternalLink className="size-4" />
                      {locale === 'ru' ? 'Открыть результат' : 'Open result'}
                    </a>
                    {item.provider === 'apimodels' && item.model === 'seedance-2.5' && onRepeatGeneration && (
                      <button
                        type="button"
                        onClick={() => {
                          haptics.impact('light')
                          onRepeatGeneration(item.id)
                        }}
                        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-brand/25 bg-brand-tint/50 text-sm font-semibold text-brand transition active:scale-[0.98]"
                      >
                        <RotateCcw className="size-4" />
                        {locale === 'ru' ? 'Повторить с теми же настройками' : 'Repeat with same settings'}
                      </button>
                    )}
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      {locale === 'ru'
                        ? 'Сохраните результат на устройство. Медиафайл может быть автоматически удалён из Banana Zero через 14 дней.'
                        : 'Save the result to your device. The media file may be automatically removed from Banana Zero after 14 days.'}
                    </p>
                    {downloadErrorId === item.id && (
                      <p className="mt-2 text-center text-xs text-destructive">
                        {locale === 'ru' ? 'Не удалось скачать файл. Попробуйте ещё раз.' : 'Could not download the file. Please try again.'}
                      </p>
                    )}
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
