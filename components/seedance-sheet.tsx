'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, ImagePlus, RefreshCw, Sparkles, Trash2, Volume2 } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

const TOKEN_COST = 40

type ReferenceUpload = {
  file: File
  url: string
  name: string
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

function ReferenceSlot({
  index,
  value,
  disabled,
  onChange,
  onClear,
}: {
  index: number
  value?: ReferenceUpload
  disabled?: boolean
  onChange: (upload: ReferenceUpload) => void
  onClear: () => void
}) {
  const { locale } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    const file = await compressImageIfNeeded(selected)
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    haptics.impact('light')
    onChange({ file, url, name: file.name })
    event.target.value = ''
  }

  return (
    <div className={`rounded-2xl border p-3 ${disabled ? 'opacity-45' : 'bg-card'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">@Image{index}</p>
          <p className="text-[11px] text-muted-foreground">
            {locale === 'ru' ? `Референс ${index}` : `Reference ${index}`}
          </p>
        </div>
        {value && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand">
            <Check className="size-3.5" />{locale === 'ru' ? 'Добавлен' : 'Added'}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => void handleFile(event)}
        className="sr-only"
      />

      {value ? (
        <div className="mt-3 flex items-center gap-3">
          <img src={value.url} alt={`Reference ${index}`} className="size-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{value.name}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium"
              >
                <RefreshCw className="size-3.5" />{locale === 'ru' ? 'Заменить' : 'Change'}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="flex size-8 items-center justify-center rounded-full border text-muted-foreground"
                aria-label={locale === 'ru' ? 'Удалить' : 'Remove'}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/25 bg-brand-tint/40 text-sm font-medium text-brand disabled:cursor-not-allowed"
        >
          <ImagePlus className="size-4" />
          {disabled
            ? (locale === 'ru' ? 'Сначала добавьте предыдущий' : 'Add the previous reference first')
            : (locale === 'ru' ? 'Добавить фото' : 'Add image')}
        </button>
      )}
    </div>
  )
}

export function SeedanceSheet({
  open,
  onClose,
  onGenerationStarted,
}: {
  open: boolean
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const [prompt, setPrompt] = useState('')
  const [references, setReferences] = useState<Array<ReferenceUpload | undefined>>([undefined, undefined, undefined])
  const [duration, setDuration] = useState(12)
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  if (!open) return null

  const canAfford = tokenBalance >= TOKEN_COST
  const ready = prompt.trim().length >= 5 && canAfford && !generating

  function setReference(index: number, upload: ReferenceUpload) {
    setReferences((current) => {
      const next = [...current]
      next[index] = upload
      return next
    })
  }

  function clearReference(index: number) {
    setReferences((current) => {
      const next = [...current]
      for (let i = index; i < next.length; i += 1) next[i] = undefined
      return next
    })
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) {
      setMessage(locale === 'ru' ? 'Откройте инструмент внутри Telegram Mini App.' : 'Open this tool inside the Telegram Mini App.')
      return
    }
    if (!prompt.trim()) return

    setGenerating(true)
    setMessage(locale === 'ru' ? 'Запускаю Seedance 2.5…' : 'Starting Seedance 2.5…')

    try {
      const form = new FormData()
      form.append('prompt', prompt.trim())
      form.append('duration', String(duration))
      form.append('resolution', resolution)
      form.append('generateAudio', generateAudio ? 'true' : 'false')
      references.forEach((reference, index) => {
        if (reference?.file) form.append(`reference${index + 1}`, reference.file, reference.file.name)
      })

      const response = await fetch('/api/generate/direct', {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': initData },
        body: form,
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data?.ok && data?.jobId) {
        haptics.success()
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }

      if (data?.error === 'INSUFFICIENT_TOKENS') {
        setMessage(locale === 'ru' ? 'Недостаточно токенов приложения для теста.' : 'Not enough app tokens for this test.')
      } else if (data?.error === 'REFERENCE_IMAGE_TOO_LARGE') {
        setMessage(locale === 'ru' ? 'Одно из фото слишком большое. Выберите другое фото.' : 'One reference image is too large.')
      } else if (data?.details) {
        setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${String(data.details).slice(0, 180)}`)
      } else {
        setMessage(locale === 'ru' ? 'Не удалось запустить генерацию.' : 'Could not start generation.')
      }
      await refreshUser()
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось связаться с сервером.' : 'Could not reach the server.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <BottomSheet open title="Seedance 2.5" onClose={onClose}>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/60 px-4 py-3">
        <p className="text-sm font-semibold text-brand">{locale === 'ru' ? 'Прямой тест через BytePlus API' : 'Direct BytePlus API test'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === 'ru'
            ? 'Промпт отправляется напрямую в Seedance 2.5. Референсы идут по порядку: @Image1, @Image2, @Image3.'
            : 'Your prompt goes directly to Seedance 2.5. References map in order to @Image1, @Image2 and @Image3.'}
        </p>
      </div>

      <label htmlFor="seedance-prompt" className="mt-5 block text-sm font-semibold">
        {locale === 'ru' ? 'Промпт' : 'Prompt'}
      </label>
      <textarea
        id="seedance-prompt"
        rows={8}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={locale === 'ru'
          ? 'Вставьте промпт. Для фото используйте @Image1, @Image2, @Image3…'
          : 'Paste a prompt. Refer to uploaded images as @Image1, @Image2, @Image3…'}
        className="mt-2 w-full resize-y rounded-2xl border bg-card p-4 text-sm leading-relaxed"
      />

      <div className="mt-5 grid gap-3">
        {references.map((reference, index) => (
          <ReferenceSlot
            key={index}
            index={index + 1}
            value={reference}
            disabled={index > 0 && !references[index - 1]}
            onChange={(upload) => setReference(index, upload)}
            onClear={() => clearReference(index)}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span className="block font-medium">{locale === 'ru' ? 'Длительность' : 'Duration'}</span>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground"
          >
            {[8, 10, 12, 15, 20, 30].map((seconds) => <option key={seconds} value={seconds}>{seconds} сек</option>)}
          </select>
        </label>

        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span className="block font-medium">{locale === 'ru' ? 'Качество' : 'Quality'}</span>
          <select
            value={resolution}
            onChange={(event) => setResolution(event.target.value === '720p' ? '720p' : '480p')}
            className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground"
          >
            <option value="480p">480p · test</option>
            <option value="720p">720p</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={generateAudio}
        onClick={() => {
          haptics.selection()
          setGenerateAudio((value) => !value)
        }}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
          <Volume2 className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{locale === 'ru' ? 'Со звуком' : 'Generate with sound'}</span>
          <span className="block text-xs text-muted-foreground">
            {locale === 'ru' ? 'Синхронный звук Seedance включён.' : 'Seedance synchronized audio is enabled.'}
          </span>
        </span>
        <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${generateAudio ? 'bg-brand' : 'bg-muted'}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${generateAudio ? 'left-6' : 'left-1'}`} />
        </span>
      </button>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={!ready}
        className="brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45"
      >
        <Sparkles className="size-4" />
        {generating
          ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
          : (locale === 'ru' ? `Создать видео · ${TOKEN_COST} токенов` : `Generate video · ${TOKEN_COST} tokens`)}
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
        {message || (canAfford
          ? (locale === 'ru' ? 'Для тестов камеры лучше начинать с 480p.' : 'Use 480p first while testing camera motion.')
          : (locale === 'ru' ? 'Недостаточно токенов приложения.' : 'Not enough app tokens.'))}
      </p>
    </BottomSheet>
  )
}
