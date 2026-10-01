'use client'

import { ArrowRight, Check, ImagePlus, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSiteLocale } from './site-locale-provider'

type TrendInput = {
  id: string
  kind: 'photo' | 'video' | 'audio' | 'text'
  label: { en: string; ru?: string }
  hint?: { en: string; ru?: string }
  required?: boolean
  defaultAsset?: { url: string; name?: string }
}

type Trend = {
  id: string
  title: { en: string; ru?: string }
  image: string
  previewVideo?: string | null
  cardBadge?: 'hit' | 'new' | 'popular'
  aspectRatio?: string
  tokens?: number
  inputs?: TrendInput[]
  resolutions?: string[]
}

type UploadValue = {
  file: File
  url: string
}

export function SiteTrendHits() {
  const { locale } = useSiteLocale()
  const [trends, setTrends] = useState<Trend[]>([])
  const [showAll, setShowAll] = useState(false)
  const [activeTrend, setActiveTrend] = useState<Trend | null>(null)
  const [uploads, setUploads] = useState<Record<string, UploadValue>>({})
  const [resolution, setResolution] = useState('480p')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void fetch('/api/trends', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (Array.isArray(data?.trends)) setTrends(data.trends)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => () => {
    Object.values(uploads).forEach((item) => URL.revokeObjectURL(item.url))
  }, [uploads])

  function openTrend(trend: Trend) {
    Object.values(uploads).forEach((item) => URL.revokeObjectURL(item.url))
    setUploads({})
    setNotice('')
    setResolution(trend.resolutions?.[0] || '480p')
    setActiveTrend(trend)
  }

  function closeTrend() {
    Object.values(uploads).forEach((item) => URL.revokeObjectURL(item.url))
    setUploads({})
    setNotice('')
    setActiveTrend(null)
  }

  function setFile(inputId: string, file: File) {
    setUploads((current) => {
      const previous = current[inputId]
      if (previous?.url) URL.revokeObjectURL(previous.url)
      return { ...current, [inputId]: { file, url: URL.createObjectURL(file) } }
    })
    setNotice('')
  }

  const visibleTrends = showAll ? trends : trends.slice(0, 3)

  return (
    <>
      <section id="trends" className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-18">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF3D6] px-3 py-1.5 text-xs font-bold text-[#8B5C00]">
              <Sparkles className="size-3.5" />
              {locale === 'ru' ? 'ХИТЫ' : 'TRENDING'}
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] md:text-4xl">{locale === 'ru' ? 'Тренды, которые хочется повторить' : 'Trends worth recreating'}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758E]">{locale === 'ru' ? 'Выберите тренд — форма откроется прямо здесь. Никаких переходов в другой интерфейс.' : 'Choose a trend — the form opens right here without sending you to another interface.'}</p>
          </div>
          {trends.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="inline-flex items-center gap-2 self-start rounded-full border border-[#CBD5F3] bg-white px-5 py-3 text-sm font-semibold text-[#1E3A8A] md:self-auto"
            >
              {showAll ? (locale === 'ru' ? 'Скрыть' : 'Show less') : (locale === 'ru' ? 'Все тренды' : 'All trends')} <ArrowRight className={`size-4 transition ${showAll ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {visibleTrends.length > 0 ? visibleTrends.map((trend, index) => (
            <article key={trend.id} className="overflow-hidden rounded-[1.75rem] border border-[#E6EEFF] bg-white shadow-[0_18px_45px_-32px_rgba(30,58,138,0.35)]">
              <button type="button" onClick={() => openTrend(trend)} className="block w-full text-left">
                <div className="relative aspect-[4/5] overflow-hidden bg-[#EDF2FF]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={trend.image} alt={locale === 'ru' ? (trend.title.ru || trend.title.en) : trend.title.en} className="size-full object-cover" />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    {(trend.cardBadge || index === 0) && (
                      <span className="rounded-full bg-[#F6AB10] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-[#171A22] shadow-sm">
                        {trend.cardBadge === 'new' ? 'NEW' : trend.cardBadge === 'popular' ? (locale === 'ru' ? 'ПОПУЛЯРНО' : 'POPULAR') : (locale === 'ru' ? 'ХИТ' : 'HIT')}
                      </span>
                    )}
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#334155] backdrop-blur">{locale === 'ru' ? 'Видео' : 'Video'}</span>
                  </div>
                </div>
              </button>
              <div className="p-4">
                <h3 className="text-base font-bold">{locale === 'ru' ? (trend.title.ru || trend.title.en) : trend.title.en}</h3>
                <button
                  type="button"
                  onClick={() => openTrend(trend)}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1E3A8A] text-sm font-semibold text-white"
                >
                  {locale === 'ru' ? 'Создать тренд' : 'Create trend'} <ArrowRight className="size-4" />
                </button>
              </div>
            </article>
          )) : [0,1,2].map((item) => (
            <div key={item} className="overflow-hidden rounded-[1.75rem] border border-[#E6EEFF] bg-white">
              <div className="aspect-[4/5] animate-pulse bg-[#EDF2FF]" />
              <div className="p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-[#EDF2FF]" /><div className="mt-4 h-11 animate-pulse rounded-full bg-[#E0E7FF]" /></div>
            </div>
          ))}
        </div>
      </section>

      {activeTrend && (
        <TrendModal
          locale={locale}
          trend={activeTrend}
          uploads={uploads}
          resolution={resolution}
          notice={notice}
          onClose={closeTrend}
          onFile={setFile}
          onResolution={setResolution}
          onGenerate={() => setNotice(locale === 'ru' ? 'Форма готова. Для запуска на сайте нужен веб-вход в Banana Zero; до его подключения генерация запускается из Mini App.' : 'The form is ready. Web sign-in is required to run generation on the website; until it is connected, generation starts from the Mini App.')}
        />
      )}
    </>
  )
}

function TrendModal({
  locale,
  trend,
  uploads,
  resolution,
  notice,
  onClose,
  onFile,
  onResolution,
  onGenerate,
}: {
  locale: 'ru' | 'en'
  trend: Trend
  uploads: Record<string, UploadValue>
  resolution: string
  notice: string
  onClose: () => void
  onFile: (inputId: string, file: File) => void
  onResolution: (value: string) => void
  onGenerate: () => void
}) {
  const inputs = trend.inputs || []
  const requiredReady = useMemo(
    () => inputs.every((input) => !input.required || Boolean(uploads[input.id]) || Boolean(input.defaultAsset?.url)),
    [inputs, uploads],
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#07101f]/55 p-0 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label={locale === 'ru' ? 'Закрыть' : 'Close'} onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-[#F8FAFF] p-5 shadow-2xl md:max-w-2xl md:rounded-[2rem] md:p-7">
        <div className="sticky top-0 z-20 -mx-1 flex items-start justify-between gap-4 bg-[#F8FAFF]/95 px-1 pb-4 backdrop-blur">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[#1E3A8A]">{locale === 'ru' ? 'СОЗДАТЬ ТРЕНД' : 'CREATE TREND'}</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight">{locale === 'ru' ? (trend.title.ru || trend.title.en) : trend.title.en}</h3>
          </div>
          <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#DCE5F7] bg-white">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-[#E6EEFF] bg-black" style={{ aspectRatio: trend.aspectRatio?.replace(':', ' / ') || '9 / 16' }}>
              {trend.previewVideo ? (
                <video src={trend.previewVideo} poster={trend.image} muted loop autoPlay playsInline controls className="size-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={trend.image} alt="" className="size-full object-cover" />
              )}
            </div>
            {typeof trend.tokens === 'number' && (
              <div className="mt-3 rounded-2xl border border-[#E6EEFF] bg-white px-4 py-3">
                <p className="text-xs text-[#7B899D]">{locale === 'ru' ? 'Стоимость' : 'Price'}</p>
                <p className="mt-1 text-sm font-bold">{trend.tokens} {locale === 'ru' ? 'токенов' : 'Tokens'}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-bold">{locale === 'ru' ? 'Загрузите свои материалы' : 'Upload your media'}</p>
            <p className="mt-1 text-xs leading-5 text-[#7B899D]">{locale === 'ru' ? 'Форма остаётся на BananaZero.ru — после выбора фото вас никуда не перебрасывает.' : 'The form stays on BananaZero.ru — selecting a file never sends you somewhere else.'}</p>

            <div className="mt-4 space-y-3">
              {inputs.map((input) => {
                const upload = uploads[input.id]
                const readyAsset = upload?.url || input.defaultAsset?.url
                const accept = input.kind === 'photo' ? 'image/*' : input.kind === 'video' ? 'video/*' : input.kind === 'audio' ? 'audio/*' : undefined

                if (input.kind === 'text') {
                  return (
                    <label key={input.id} className="block rounded-2xl border border-[#E6EEFF] bg-white p-4">
                      <span className="text-sm font-semibold">{locale === 'ru' ? (input.label.ru || input.label.en) : input.label.en}</span>
                      {(locale === 'ru' ? input.hint?.ru : input.hint?.en) && <span className="mt-1 block text-xs text-[#7B899D]">{locale === 'ru' ? input.hint?.ru : input.hint?.en}</span>}
                      <textarea rows={3} className="mt-3 w-full resize-none rounded-xl border border-[#DCE5F7] bg-[#F8FAFF] p-3 text-sm" />
                    </label>
                  )
                }

                return (
                  <label key={input.id} className="block cursor-pointer rounded-2xl border border-[#E6EEFF] bg-white p-4 transition active:scale-[0.995]">
                    <div className="flex items-center gap-3">
                      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF3FF] text-[#1E3A8A]">
                        {readyAsset ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={readyAsset} alt="" className="size-full object-cover" />
                        ) : (
                          <ImagePlus className="size-6" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{locale === 'ru' ? (input.label.ru || input.label.en) : input.label.en}</p>
                          {!input.required && <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[10px] text-[#66758E]">{locale === 'ru' ? 'необязательно' : 'optional'}</span>}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#7B899D]">
                          {upload ? upload.file.name : input.defaultAsset ? (locale === 'ru' ? 'Уже добавлено — можно заменить' : 'Already included — you can replace it') : (locale === 'ru' ? (input.hint?.ru || input.hint?.en || 'Добавьте файл') : (input.hint?.en || 'Add a file'))}
                        </p>
                      </div>
                      {readyAsset ? <Check className="size-5 shrink-0 text-[#1E3A8A]" /> : <span className="shrink-0 text-xs font-semibold text-[#1E3A8A]">{locale === 'ru' ? 'Загрузить' : 'Upload'}</span>}
                    </div>
                    <input
                      type="file"
                      accept={accept}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) onFile(input.id, file)
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                )
              })}
            </div>

            {(trend.resolutions?.length || 0) > 0 && (
              <label className="mt-4 block rounded-2xl border border-[#E6EEFF] bg-white p-4">
                <span className="text-xs font-semibold text-[#66758E]">{locale === 'ru' ? 'Качество' : 'Quality'}</span>
                <select value={resolution} onChange={(e) => onResolution(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#DCE5F7] bg-[#F8FAFF] px-3 text-sm font-semibold">
                  {trend.resolutions!.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            )}

            <button
              type="button"
              disabled={!requiredReady}
              onClick={onGenerate}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1E3A8A] text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(30,58,138,0.8)] disabled:opacity-40"
            >
              <Sparkles className="size-4" />
              {locale === 'ru' ? 'Запустить генерацию' : 'Start generation'}
            </button>

            {notice && <p className="mt-3 rounded-2xl bg-[#EEF3FF] px-4 py-3 text-xs leading-5 text-[#52627A]">{notice}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
