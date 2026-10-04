'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Download, Expand, FolderOpen, Image as ImageIcon, LoaderCircle, Music2, RefreshCw, RotateCcw, Trash2, Video, X } from 'lucide-react'
import { getTelegramInitData, getWebApp, haptics, openExternalLink } from '@/lib/telegram'
import { useI18n } from '../i18n-provider'
import { useUserState, type HistoryItem } from '../user-provider'
import type { UpscaleSource } from '../upscale-sheet'

function isVideoUrl(url: unknown) {
  if (typeof url !== 'string') return false
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/Video/') || url.includes('cloudfront.net') || url.includes('/videos/')
}

function isAudioUrl(url: unknown) {
  if (typeof url !== 'string') return false
  return /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url) || url.includes('/audio/')
}

function extensionForType(contentType: string, kind: 'video' | 'image' | 'audio') {
  if (contentType.includes('audio/wav')) return 'wav'
  if (contentType.includes('audio/mp4') || contentType.includes('audio/x-m4a')) return 'm4a'
  if (contentType.includes('audio/ogg')) return 'ogg'
  if (contentType.includes('audio/flac')) return 'flac'
  if (contentType.includes('audio/')) return 'mp3'
  if (contentType.includes('video/webm')) return 'webm'
  if (contentType.includes('video/quicktime')) return 'mov'
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('image/png')) return 'png'
  return kind === 'audio' ? 'mp3' : kind === 'video' ? 'mp4' : 'png'
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

export function WorksScreen({ onRepeatGeneration, onUpscale }: { onRepeatGeneration?: (jobId: string) => void; onUpscale?: (source: UpscaleSource) => void }) {
  const { locale } = useI18n()
  const { refreshUser, markWorksSeen } = useUserState()
  const [works, setWorks] = useState<HistoryItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [loadingPage, setLoadingPage] = useState(false)
  const [openMedia, setOpenMedia] = useState<HistoryItem | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadErrorId, setDownloadErrorId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [retryErrorId, setRetryErrorId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null)
  const [workFilter, setWorkFilter] = useState<'all' | 'video' | 'image' | 'audio'>('all')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const visibleHistory = useMemo(() => works.filter((item) => {
    if (item.status !== 'failed') return true
    const failed = new Date(item.failedAt || item.createdAt).getTime()
    if (!Number.isFinite(failed)) return false
    return Date.now() - failed < 24 * 60 * 60 * 1000
  }), [works])

  const mediaKind = (item: HistoryItem): 'video' | 'image' | 'audio' | 'unknown' => {
    if (item.resultUrl) return isAudioUrl(item.resultUrl) ? 'audio' : isVideoUrl(item.resultUrl) ? 'video' : 'image'
    const title = String(item.title || '').toLowerCase()
    const model = String(item.model || '').toLowerCase()
    if (title.includes('audio') || /audio|sound|music|tts/.test(model)) return 'audio'
    if (title.includes('video') || /seedance|veo|runway|kling.*video/.test(model)) return 'video'
    if (title.includes('image') || /nano|gpt-image|midjourney|flux|image/.test(model)) return 'image'
    return 'unknown'
  }

  const workCounts = useMemo(() => ({
    all: visibleHistory.length,
    video: visibleHistory.filter((item) => mediaKind(item) === 'video').length,
    image: visibleHistory.filter((item) => mediaKind(item) === 'image').length,
    audio: visibleHistory.filter((item) => mediaKind(item) === 'audio').length,
  }), [visibleHistory])

  const filteredHistory = useMemo(
    () => workFilter === 'all'
      ? visibleHistory
      : visibleHistory.filter((item) => mediaKind(item) === workFilter),
    [visibleHistory, workFilter],
  )

  const fetchWorksPage = useCallback(async (offset: number, replace: boolean) => {
    const initData = getTelegramInitData()
    if (!initData) return

    if (!replace) setLoadingPage(true)
    try {
      const response = await fetch(`/api/history?limit=5&offset=${Math.max(0, offset)}`, {
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(data?.history)) return

      const page = data.history as HistoryItem[]
      setWorks((current) => {
        if (replace) return page
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.filter((item) => !seen.has(item.id))]
      })
      setHasMore(Boolean(data?.pagination?.hasMore))
      setNextOffset(
        typeof data?.pagination?.nextOffset === 'number'
          ? data.pagination.nextOffset
          : offset + page.length,
      )
    } finally {
      if (!replace) setLoadingPage(false)
    }
  }, [])

  useEffect(() => {
    markWorksSeen()
    void fetchWorksPage(0, true)
  }, [markWorksSeen, fetchWorksPage])

  async function manualRefresh() {
    haptics.selection()
    setRefreshing(true)
    try {
      const initData = getTelegramInitData()
      if (initData) {
        const active = works.filter((item) => item.status === 'queued' || item.status === 'processing')
        await Promise.all(active.map((item) =>
          fetch(`/api/generate/status?jobId=${encodeURIComponent(item.id)}`, {
            headers: { 'X-Telegram-Init-Data': initData },
            cache: 'no-store',
          }).catch(() => undefined),
        ))
      }
      await Promise.all([refreshUser(), fetchWorksPage(0, true)])
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
      await Promise.all([refreshUser(), fetchWorksPage(0, true)])
    } catch {
      setRetryErrorId(item.id)
    } finally {
      setRetryingId(null)
    }
  }

  async function deleteWorks() {
    const initData = getTelegramInitData()
    if (!initData || !deleteTarget || deleting) return

    setDeleting(true)
    setDeleteError(false)
    try {
      const endpoint = `/api/history?jobId=${encodeURIComponent(deleteTarget.id)}`
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.ok) throw new Error(String(data?.error || 'DELETE_FAILED'))

      haptics.success()
      if (openMedia?.id === deleteTarget.id) setOpenMedia(null)
      setDeleteTarget(null)
      await Promise.all([refreshUser(), fetchWorksPage(0, true)])
    } catch {
      haptics.impact('medium')
      setDeleteError(true)
    } finally {
      setDeleting(false)
    }
  }

  async function downloadResult(item: HistoryItem) {
    const initData = getTelegramInitData()
    if (!initData || typeof item.resultUrl !== 'string' || !item.resultUrl) return
    setDownloadingId(item.id)
    setDownloadErrorId(null)

    try {
      const audio = isAudioUrl(item.resultUrl)
      const video = !audio && isVideoUrl(item.resultUrl)
      const kind: 'video' | 'image' | 'audio' = audio ? 'audio' : video ? 'video' : 'image'
      const prepare = await fetch(`/api/download?prepare=1&jobId=${encodeURIComponent(item.id)}`, {
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
      const data = await prepare.json().catch(() => ({}))
      if (!prepare.ok || !data?.url || !data?.fileName) throw new Error('DOWNLOAD_PREPARE_FAILED')

      const app = getWebApp()
      const supportsNativeDownload = Boolean(
        app?.downloadFile &&
        (!app.isVersionAtLeast || app.isVersionAtLeast('8.0')),
      )

      // Telegram's native download flow is the primary path on every supported
      // platform, including iOS. It avoids loading the whole video into the
      // WebView and then trying to open navigator.share after user activation
      // may already have expired.
      if (supportsNativeDownload && app?.downloadFile) {
        await new Promise<void>((resolve, reject) => {
          let settled = false
          const timeout = window.setTimeout(() => {
            if (!settled) {
              settled = true
              reject(new Error('DOWNLOAD_DIALOG_TIMEOUT'))
            }
          }, 30_000)

          app.downloadFile?.(
            { url: String(data.url), file_name: String(data.fileName) },
            (accepted) => {
              if (settled) return
              settled = true
              window.clearTimeout(timeout)
              if (accepted) resolve()
              else reject(new Error('DOWNLOAD_DECLINED'))
            },
          )
        })
        haptics.success()
        return
      }

      const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isAppleMobile) {
        const response = await fetch(`/api/download?jobId=${encodeURIComponent(item.id)}`, {
          headers: { 'X-Telegram-Init-Data': initData },
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`DOWNLOAD_${response.status}`)

        const blob = await response.blob()
        const mimeType = audio ? (blob.type || response.headers.get('content-type') || 'audio/mpeg') : video ? 'video/mp4' : (blob.type || response.headers.get('content-type') || 'image/png')
        const ext = extensionForType(mimeType, kind)
        const filename = `Banana-Zero-${kind}-${item.id.slice(0, 8)}.${ext}`
        const file = new File([blob], filename, { type: mimeType })
        const shareNavigator = navigator as Navigator & {
          canShare?: (data?: ShareData) => boolean
          share?: (data: ShareData) => Promise<void>
        }

        if (shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))) {
          try {
            await shareNavigator.share({ files: [file], title: filename })
            haptics.success()
            return
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error
          }
        }

        // Last-resort iOS fallback: open the already prepared signed download URL
        // instead of forcing the user to press Download repeatedly.
        openExternalLink(String(data.url))
        haptics.success()
        return
      }

      openExternalLink(String(data.url))
      haptics.success()
    } catch (error) {
      // A deliberate cancel is not a broken download.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setDownloadErrorId(item.id)
      }
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void manualRefresh()}
            disabled={refreshing}
            aria-label={locale === 'ru' ? 'Обновить' : 'Refresh'}
            className="glass flex size-10 items-center justify-center rounded-full text-muted-foreground transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {visibleHistory.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2 rounded-2xl bg-muted/45 p-1.5">
          {([
            { key: 'all', icon: FolderOpen, ru: 'Все', en: 'All', count: workCounts.all },
            { key: 'video', icon: Video, ru: 'Видео', en: 'Video', count: workCounts.video },
            { key: 'image', icon: ImageIcon, ru: 'Фото', en: 'Images', count: workCounts.image },
            { key: 'audio', icon: Music2, ru: 'Аудио', en: 'Audio', count: workCounts.audio },
          ] as const).map((filter) => {
            const Icon = filter.icon
            const active = workFilter === filter.key
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  haptics.selection()
                  setWorkFilter(filter.key)
                }}
                className={`flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition active:scale-[0.98] ${active ? 'bg-background text-brand shadow-sm' : 'text-muted-foreground'}`}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{locale === 'ru' ? filter.ru : filter.en}</span>
                <span className={`shrink-0 text-[10px] ${active ? 'text-brand' : 'text-muted-foreground/70'}`}>{filter.count}</span>
              </button>
            )
          })}
        </div>
      )}

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
      ) : filteredHistory.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
{workFilter === 'video' ? <Video className="size-6" /> : workFilter === 'audio' ? <Music2 className="size-6" /> : <ImageIcon className="size-6" />}
          </span>
          <h2 className="mt-4 text-base font-semibold">
            {locale === 'ru'
              ? (workFilter === 'video' ? 'Видео пока нет' : workFilter === 'audio' ? 'Аудио пока нет' : 'Изображений пока нет')
              : (workFilter === 'video' ? 'No videos yet' : workFilter === 'audio' ? 'No audio yet' : 'No images yet')}
          </h2>
          {hasMore && (
            <button
              type="button"
              onClick={() => void fetchWorksPage(nextOffset, false)}
              disabled={loadingPage}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full border bg-card text-sm font-semibold text-brand transition active:scale-[0.98] disabled:opacity-55"
            >
              {loadingPage ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {locale === 'ru' ? 'Показать ещё' : 'Show more'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredHistory.map((item) => {
            const created = new Date(item.createdAt)
            const dateLabel = Number.isNaN(created.getTime())
              ? ''
              : new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                }).format(created)
            const elapsedMinutes = Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000))
            const takingLonger = (item.status === 'queued' || item.status === 'processing') && elapsedMinutes >= 25
            const audio = Boolean(item.resultUrl && isAudioUrl(item.resultUrl))
            const video = Boolean(item.resultUrl && !audio && isVideoUrl(item.resultUrl))

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

                {item.status === 'completed' && typeof item.resultUrl === 'string' && item.resultUrl && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        haptics.impact('light')
                        setOpenMedia(item)
                      }}
                      className="flex min-h-20 w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition active:scale-[0.99]"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                        {audio ? <Music2 className="size-5" /> : video ? <Video className="size-5" /> : <ImageIcon className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {locale === 'ru'
                            ? (audio ? 'Открыть аудио' : video ? 'Открыть видео' : 'Открыть изображение')
                            : (audio ? 'Open audio' : video ? 'Open video' : 'Open image')}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {locale === 'ru' ? 'Файл загрузится только после открытия' : 'The file loads only after you open it'}
                        </span>
                      </span>
                    </button>

                    <div className={onUpscale && !audio ? "mt-2 grid grid-cols-2 gap-2" : "mt-2"}>
                      <button
                        type="button"
                        onClick={() => void downloadResult(item)}
                        disabled={downloadingId === item.id}
                        className="brand-gradient flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-55"
                      >
                        {downloadingId === item.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {downloadingId === item.id
                          ? (locale === 'ru' ? 'Подготавливаю…' : 'Preparing…')
                          : audio
                            ? (locale === 'ru' ? 'Скачать аудио' : 'Download audio')
                            : video
                              ? (locale === 'ru' ? 'Скачать видео' : 'Download video')
                              : (locale === 'ru' ? 'Скачать изображение' : 'Download image')}
                      </button>
                      {onUpscale && !audio && (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.impact('light')
                            onUpscale({
                              mediaType: video ? 'video' : 'image',
                              jobId: item.id,
                              url: item.resultUrl || undefined,
                            })
                          }}
                          className="flex h-11 items-center justify-center gap-2 rounded-full border border-brand/25 bg-brand-tint/60 text-sm font-semibold text-brand transition active:scale-[0.98]"
                        >
                          <Expand className="size-4" />
                          {locale === 'ru' ? 'Улучшить' : 'Upscale'}
                        </button>
                      )}
                    </div>

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

                {(item.status === 'completed' || item.status === 'failed') && (
                  <button
                    type="button"
                    onClick={() => {
                      haptics.impact('light')
                      setDeleteError(false)
                      setDeleteTarget(item)
                    }}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 text-sm font-semibold text-destructive transition active:scale-[0.98]"
                  >
                    <Trash2 className="size-4" />
                    {locale === 'ru' ? 'Удалить' : 'Delete'}
                  </button>
                )}
              </article>
            )
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => {
                haptics.selection()
                void fetchWorksPage(nextOffset, false)
              }}
              disabled={loadingPage}
              className="glass mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-brand transition active:scale-[0.98] disabled:opacity-55"
            >
              {loadingPage ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {locale === 'ru' ? 'Показать ещё' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {openMedia && typeof openMedia.resultUrl === 'string' && openMedia.resultUrl && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-16 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-background p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-2 pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{openMedia.title || (locale === 'ru' ? 'Результат' : 'Result')}</p>
                <p className="text-[11px] text-muted-foreground">{locale === 'ru' ? 'Загружен только один выбранный файл' : 'Only the selected file is loaded'}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenMedia(null)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-label={locale === 'ru' ? 'Закрыть' : 'Close'}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className={`overflow-hidden rounded-2xl border ${isAudioUrl(openMedia.resultUrl) ? 'bg-card p-3' : 'bg-black'}`}>
              {isAudioUrl(openMedia.resultUrl) ? (
                <audio src={openMedia.resultUrl} controls preload="metadata" className="w-full" />
              ) : isVideoUrl(openMedia.resultUrl) ? (
                <video
                  src={openMedia.resultUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[64dvh] w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- generated remote result
                <img src={openMedia.resultUrl} alt="Generated result" className="max-h-[64dvh] w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-20 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-md rounded-[28px] bg-background p-5 shadow-2xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="size-6" />
            </div>
            <h2 className="mt-4 text-center text-lg font-semibold">
              {locale === 'ru' ? 'Удалить эту работу?' : 'Delete this work?'}
            </h2>
            <p className="mt-2 text-center text-sm leading-5 text-muted-foreground">
              {locale === 'ru'
                ? 'Результат исчезнет из «Моих работ», а связанные загруженные исходники будут удалены из хранилища Banana Zero. Восстановить работу нельзя.'
                : 'The result will disappear from My works and related uploaded source files will be removed from Banana Zero storage. This cannot be undone.'}
            </p>

            {deleteError && (
              <p className="mt-3 text-center text-xs font-medium text-destructive">
                {locale === 'ru' ? 'Не удалось удалить. Попробуйте ещё раз.' : 'Could not delete. Please try again.'}
              </p>
            )}

            <button
              type="button"
              onClick={() => void deleteWorks()}
              disabled={deleting}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-destructive text-sm font-semibold text-destructive-foreground transition active:scale-[0.98] disabled:opacity-55"
            >
              {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting
                ? (locale === 'ru' ? 'Удаляю…' : 'Deleting…')
                : (locale === 'ru' ? 'Удалить навсегда' : 'Delete permanently')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleting) return
                setDeleteTarget(null)
                setDeleteError(false)
              }}
              disabled={deleting}
              className="mt-2 h-11 w-full rounded-full text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              {locale === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
