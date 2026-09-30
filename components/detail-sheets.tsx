'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, FileAudio, ImagePlus, RefreshCw, Sparkles, Trash2, Video, Volume2 } from 'lucide-react'
import { getCategory, getToolTokens, localize, type Tool, type Trend, type TrendInput } from '@/lib/data'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { TokenCost } from './tokens'
import { useUserState } from './user-provider'

type FileUpload = { url: string; isVideo: boolean; isAudio: boolean; name: string; isDefault?: boolean; file?: File }
type InputValue = FileUpload | string

export function ToolSheet({ tool, onClose }: { tool: Tool | null; onClose: () => void }) {
  const { t, locale } = useI18n()
  if (!tool) return null
  const Icon = tool.icon
  const name = localize(tool.name, locale)
  const description = localize(tool.description, locale)
  const category = localize(getCategory(tool.category).name, locale)

  return (
    <BottomSheet open title={name} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
          <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm">{description}</p>
          <p className="text-xs text-muted-foreground">{t('tool.categoryTool', { category })}</p>
        </div>
      </div>

      <label htmlFor="tool-prompt" className="mt-6 block text-xs font-medium text-muted-foreground">{t('tool.promptLabel')}</label>
      <textarea
        id="tool-prompt"
        rows={4}
        disabled
        placeholder={t('tool.promptPlaceholder')}
        className="mt-2 w-full resize-none rounded-2xl border bg-muted/60 p-4 text-base placeholder:text-muted-foreground/80 disabled:opacity-70"
      />

      <button type="button" disabled className="brand-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white disabled:opacity-45">
        <Sparkles className="size-4" aria-hidden="true" />
        {t('tool.generate', { count: getToolTokens(tool) })}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">{t('tool.soon')}</p>
    </BottomSheet>
  )
}

export function TrendSheet({
  trend,
  onClose,
  onGenerationStarted,
}: {
  trend: Trend | null
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  if (!trend) return null
  return (
    <BottomSheet open title={localize(trend.title, locale)} onClose={onClose}>
      <TrendFlow key={trend.id} trend={trend} onGenerationStarted={onGenerationStarted} />
    </BottomSheet>
  )
}

function acceptFor(kind: TrendInput['kind']) {
  if (kind === 'photo') return 'image/*'
  if (kind === 'video') return 'video/*'
  if (kind === 'audio') return 'audio/*'
  return undefined
}

function InputGlyph({ kind }: { kind: TrendInput['kind'] }) {
  if (kind === 'video') return <Video className="size-5" aria-hidden="true" />
  if (kind === 'audio') return <FileAudio className="size-5" aria-hidden="true" />
  return <ImagePlus className="size-5" aria-hidden="true" />
}

function ratioStyle(ratio?: string) {
  const [w, h] = String(ratio || '9:16').split(':').map(Number)
  return w > 0 && h > 0 ? { aspectRatio: `${w} / ${h}` } : { aspectRatio: '9 / 16' }
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 3_200_000) return file

  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
      img.src = sourceUrl
    })

    const maxSide = 2048
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, width, height)

    for (const quality of [0.9, 0.82, 0.74, 0.66]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= 3_200_000) {
        const base = file.name.replace(/\.[^.]+$/, '') || 'reference'
        return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
      }
    }
    return file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function FileInput({
  input,
  value,
  onChange,
  onClear,
}: {
  input: TrendInput
  value?: InputValue
  onChange: (value: FileUpload) => void
  onClear?: () => void
}) {
  const { t, locale } = useI18n()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const upload = typeof value === 'object' ? value : undefined

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    const file = input.kind === 'photo' ? await compressImageIfNeeded(selected) : selected
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    haptics.impact('light')
    onChange({ url, isVideo: file.type.startsWith('video/'), isAudio: file.type.startsWith('audio/'), name: file.name, file })
    e.target.value = ''
  }

  const label = localize(input.label, locale)
  const hint = input.hint ? localize(input.hint, locale) : null

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        {!input.required && <span className="text-[10px] text-muted-foreground">{t('trend.optional')}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input ref={inputRef} id={inputId} type="file" accept={acceptFor(input.kind)} onChange={(event) => void handleFile(event)} className="sr-only" />

      {upload ? (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-brand/20 bg-brand-tint/70 p-3">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-brand">
            {upload.isVideo ? (
              <video src={upload.url} muted playsInline className="size-full object-cover" />
            ) : upload.isAudio ? (
              <FileAudio className="size-6" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={upload.url} alt={label} className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-semibold text-brand"><Check className="size-4" />{upload.isDefault ? (locale === 'ru' ? 'Уже добавлено в тренд' : 'Already included') : t('trend.uploadReady')}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{upload.isDefault ? (locale === 'ru' ? `${label}: готово` : `${label}: ready`) : upload.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition active:scale-95">
              <RefreshCw className="size-3.5" />{t('trend.uploadChange')}
            </button>
            {input.removable && onClear && (
              <button type="button" onClick={onClear} aria-label="Remove" className="flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground transition active:scale-95">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <label htmlFor={inputId} className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/50 px-4 py-5 text-center transition active:scale-[0.99]">
          <span className="flex size-10 items-center justify-center rounded-full bg-card text-brand shadow-sm"><InputGlyph kind={input.kind} /></span>
          <span className="text-sm font-medium text-brand">{t('trend.uploadCta')}</span>
        </label>
      )}
    </div>
  )
}

function TrendFlow({ trend, onGenerationStarted }: { trend: Trend; onGenerationStarted?: (jobId: string) => void }) {
  const { t, locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const [values, setValues] = useState<Record<string, InputValue>>(() => Object.fromEntries(
    trend.inputs.filter((input) => input.defaultAsset?.url).map((input) => [
      input.id,
      { url: input.defaultAsset!.url, isVideo: false, isAudio: false, name: input.defaultAsset!.name || 'Default', isDefault: true } satisfies FileUpload,
    ]),
  ))
  const [generateAudio, setGenerateAudio] = useState(true)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('480p')
  const [submitted, setSubmitted] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [resultMessage, setResultMessage] = useState('')
  const title = localize(trend.title, locale)
  const category = localize(getCategory(trend.category).name, locale)
  const canAfford = tokenBalance >= trend.tokens
  const ready = trend.inputs.every((input) => !input.required || (typeof values[input.id] === 'string' ? Boolean((values[input.id] as string).trim()) : Boolean(values[input.id])))

  function setValue(id: string, value: InputValue) {
    setSubmitted(false)
    setResultMessage('')
    setValues((current) => ({ ...current, [id]: value }))
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) {
      setSubmitted(true)
      setResultMessage(t('generation.backendNeeded'))
      return
    }

    setGenerating(true)
    setSubmitted(false)
    setResultMessage(t('generation.starting'))
    try {
      const form = new FormData()
      form.append('trendId', trend.id)
      form.append('generateAudio', generateAudio ? 'true' : 'false')
      form.append('resolution', resolution)
      for (const input of trend.inputs) {
        const value = values[input.id]
        if (typeof value === 'string') {
          form.append(input.id, value)
        } else if (value?.file) {
          form.append(input.id, value.file, value.file.name)
        } else if (value?.url) {
          form.append(`${input.id}_url`, value.url)
        }
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': initData },
        body: form,
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data?.ok && (data?.status === 'processing' || data?.status === 'completed')) {
        haptics.success()
        await refreshUser()
        onGenerationStarted?.(String(data?.jobId || ''))
        return
      }

      if (data?.error === 'MOCK_PROVIDER_ERROR') {
        haptics.impact('medium')
        setResultMessage(t('generation.failedRefunded'))
      } else if (data?.error === 'INSUFFICIENT_TOKENS') {
        setResultMessage(t('trend.notEnough'))
      } else if (data?.error === 'REFERENCE_IMAGE_TOO_LARGE') {
        setResultMessage(locale === 'ru' ? 'Фото слишком большое. Выберите другое фото или уменьшите его размер.' : 'The image is too large. Choose another image or reduce its size.')
      } else if (data?.details) {
        setResultMessage(locale === 'ru' ? `Ошибка генерации: ${String(data.details).slice(0, 180)}` : `Generation error: ${String(data.details).slice(0, 180)}`)
      } else {
        setResultMessage(t('generation.backendNeeded'))
      }
      setSubmitted(true)
      await refreshUser()
    } catch {
      setSubmitted(true)
      setResultMessage(t('generation.backendNeeded'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="relative mx-auto w-full max-w-[30rem] max-h-[62dvh] overflow-hidden rounded-2xl border bg-black" style={ratioStyle(trend.aspectRatio)}>
        {trend.previewVideo ? (
          <video
            src={trend.previewVideo}
            poster={trend.image}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- trends may come from remote admin URLs
          <img src={trend.image} alt={`${title} example`} className="absolute inset-0 size-full object-cover" />
        )}
        <span className="glass pointer-events-none absolute top-2.5 left-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{t('trend.example')}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{category} · {t('trend.uses', { count: trend.uses })}</span>
        <TokenCost amount={trend.tokens} />
      </div>

      {trend.inputs.length > 0 ? (
        <section className="mt-5">
          {trend.inputs.some((input) => input.defaultAsset?.url) && (
            <div className="mb-4 rounded-2xl border border-brand/20 bg-brand-tint/70 px-4 py-3">
              <p className="text-sm font-semibold text-brand">{locale === 'ru' ? 'Торт и автомобиль уже добавлены' : 'Default assets are already included'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{locale === 'ru' ? 'Они уже будут использованы в видео. Нажмите «Заменить», только если хотите использовать свои.' : 'They will already be used in the video. Tap Change only if you want to use your own.'}</p>
            </div>
          )}
          <h3 className="text-sm font-semibold">{t('trend.inputs')}</h3>
          {trend.inputs.map((input) =>
            input.kind === 'text' ? (
              <div key={input.id} className="mt-4">
                <div className="flex items-center gap-2">
                  <label htmlFor={`trend-${input.id}`} className="text-sm font-semibold">{localize(input.label, locale)}</label>
                  {!input.required && <span className="text-[10px] text-muted-foreground">{t('trend.optional')}</span>}
                </div>
                {input.hint && <p className="text-xs text-muted-foreground">{localize(input.hint, locale)}</p>}
                <textarea
                  id={`trend-${input.id}`}
                  rows={3}
                  value={typeof values[input.id] === 'string' ? (values[input.id] as string) : ''}
                  onChange={(event) => setValue(input.id, event.target.value)}
                  placeholder={t('trend.textPlaceholder')}
                  className="mt-2 w-full resize-none rounded-2xl border bg-card p-3 text-sm"
                />
              </div>
            ) : (
              <FileInput
                key={input.id}
                input={input}
                value={values[input.id]}
                onChange={(value) => setValue(input.id, value)}
                onClear={input.removable ? () => {
                  setSubmitted(false)
                  setResultMessage('')
                  setValues((current) => { const next = { ...current }; delete next[input.id]; return next })
                } : undefined}
              />
            ),
          )}
        </section>
      ) : (
        <p className="mt-5 rounded-2xl bg-brand-tint/60 px-4 py-3 text-sm text-muted-foreground">{t('trend.noInputs')}</p>
      )}

      {trend.category === 'video' && (
        <>
          <label className="mt-5 block rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span className="block font-medium">{locale === 'ru' ? 'Качество' : 'Quality'}</span>
            <select
              value={resolution}
              onChange={(event) => setResolution((['480p', '720p', '1080p'].includes(event.target.value) ? event.target.value : '480p') as '480p' | '720p' | '1080p')}
              className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground"
            >
              <option value="480p">480p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
          <button
          type="button"
          role="switch"
          aria-checked={generateAudio}
          onClick={() => {
            haptics.selection()
            setGenerateAudio((value) => !value)
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Volume2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{locale === 'ru' ? 'Со звуком' : 'Generate with sound'}</span>
            <span className="block text-xs text-muted-foreground">{locale === 'ru' ? 'Seedance создаст синхронный звук вместе с видео.' : 'Seedance will create synchronized audio with the video.'}</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${generateAudio ? 'bg-brand' : 'bg-muted'}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${generateAudio ? 'left-6' : 'left-1'}`} />
          </span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={!ready || !canAfford || generating}
        className="brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white shadow-[0_10px_24px_-12px_oklch(0.5_0.21_264/0.8)] transition active:scale-[0.98] disabled:opacity-45 disabled:shadow-none"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {generating ? (locale === 'ru' ? 'Запускаю…' : 'Starting…') : canAfford ? t('trend.generate', { count: trend.tokens }) : t('trend.notEnough')}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
        {submitted || generating ? resultMessage : (locale === 'ru' ? 'После запуска задача сразу появится в «Мои работы».' : 'After launch, the job will appear in My works immediately.')}
      </p>
    </div>
  )
}
