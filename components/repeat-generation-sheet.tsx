'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Check, Copy, ImagePlus, LoaderCircle, RefreshCw, Sparkles, Video } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

type RepeatReference = {
  path: string
  url: string
  label: string
}

type RepeatTemplate = {
  jobId: string
  title: string
  prompt: string
  duration: number
  resolution: '480p' | '720p'
  aspectRatio: string
  generateAudio: boolean
  referenceTags: string[]
  sourceVideo: {
    path: string
    url: string
    label: string
  }
  references: RepeatReference[]
}

type Replacement = {
  file: File
  url: string
}

async function uploadInputFile(file: File, initData: string) {
  const signResponse = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
    },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  })
  const signed = await signResponse.json().catch(() => ({}))
  if (!signResponse.ok || !signed?.signedUrl || !signed?.path) {
    throw new Error(String(signed?.details || signed?.error || 'UPLOAD_SIGN_FAILED'))
  }

  const body = new FormData()
  body.append('cacheControl', '3600')
  body.append('', file)
  const uploadResponse = await fetch(String(signed.signedUrl), {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body,
  })
  if (!uploadResponse.ok) throw new Error(`INPUT_UPLOAD_FAILED_${uploadResponse.status}`)
  return String(signed.path)
}

export function RepeatGenerationSheet({
  jobId,
  onClose,
  onGenerationStarted,
}: {
  jobId: string | null
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  const { refreshUser } = useUserState()
  const [template, setTemplate] = useState<RepeatTemplate | null>(null)
  const [prompt, setPrompt] = useState('')
  const [replacements, setReplacements] = useState<Record<number, Replacement>>({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const objectUrls = useRef<string[]>([])

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.current = []
    }
  }, [])

  useEffect(() => {
    if (!jobId) {
      setTemplate(null)
      setPrompt('')
      setReplacements({})
      setMessage('')
      setCopied(false)
      return
    }

    const initData = getTelegramInitData()
    if (!initData) {
      setMessage(locale === 'ru' ? 'Откройте приложение внутри Telegram.' : 'Open the app inside Telegram.')
      return
    }

    let cancelled = false
    setLoading(true)
    setMessage('')
    setCopied(false)
    setTemplate(null)
    setReplacements({})

    fetch(`/api/generate/repeat?jobId=${encodeURIComponent(jobId)}`, {
      headers: { 'X-Telegram-Init-Data': initData },
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.ok || !data?.template) {
          throw new Error(String(data?.error || 'REPEAT_TEMPLATE_FAILED'))
        }
        return data.template as RepeatTemplate
      })
      .then((next) => {
        if (cancelled) return
        setTemplate(next)
        setPrompt(next.prompt)
      })
      .catch((error) => {
        if (cancelled) return
        setMessage(`${locale === 'ru' ? 'Не удалось открыть исходную генерацию' : 'Could not open the source generation'}: ${error instanceof Error ? error.message : 'ERROR'}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [jobId, locale])

  const changedCount = useMemo(() => Object.keys(replacements).length, [replacements])

  function handleReplacement(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage(locale === 'ru' ? 'Нужен файл изображения.' : 'Choose an image file.')
      return
    }
    const url = URL.createObjectURL(file)
    objectUrls.current.push(url)
    setReplacements((current) => ({ ...current, [index]: { file, url } }))
    setMessage('')
    haptics.impact('light')
  }

  async function copyPrompt() {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      haptics.success()
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось скопировать автоматически. Выделите текст вручную.' : 'Could not copy automatically. Select the text manually.')
    }
  }

  async function generate() {
    if (!template || generating) return
    const initData = getTelegramInitData()
    if (!initData) return

    setGenerating(true)
    setMessage(locale === 'ru' ? 'Клонирую успешную конфигурацию…' : 'Cloning the successful configuration…')

    try {
      const referencePaths = await Promise.all(
        template.references.map(async (reference, index) => {
          const replacement = replacements[index]
          return replacement ? uploadInputFile(replacement.file, initData) : reference.path
        }),
      )

      const response = await fetch('/api/generate/repeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          jobId: template.jobId,
          prompt,
          referencePaths,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.ok || !data?.jobId) {
        throw new Error(String(data?.details || data?.error || 'REPEAT_FAILED'))
      }

      haptics.success()
      await refreshUser()
      onGenerationStarted?.(String(data.jobId))
    } catch (error) {
      setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${error instanceof Error ? error.message.slice(0, 220) : 'REPEAT_FAILED'}`)
    } finally {
      setGenerating(false)
    }
  }

  if (!jobId) return null

  return (
    <BottomSheet open title={locale === 'ru' ? 'Повторить генерацию' : 'Repeat generation'} onClose={onClose}>
      {loading && (
        <div className="flex min-h-48 items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-brand" />
        </div>
      )}

      {!loading && template && (
        <>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Check className="size-4" />
              {locale === 'ru' ? 'Это точная конфигурация выбранного готового видео' : 'This is the exact configuration of the selected completed video'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === 'ru'
                ? 'Исходное видео, порядок референсов, длительность, качество, формат и звук сохранены из истории.'
                : 'Source video, reference order, duration, quality, aspect ratio, and sound are loaded from history.'}
            </p>
          </div>

          <section className="mt-4 rounded-2xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <Video className="size-4 text-brand" />
              <p className="text-sm font-semibold">{template.sourceVideo.label} · {locale === 'ru' ? 'тот же исходник' : 'same source'}</p>
            </div>
            <video src={template.sourceVideo.url} controls muted playsInline preload="metadata" className="mt-3 max-h-64 w-full rounded-xl bg-black object-contain" />
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{locale === 'ru' ? 'Промпт из этой генерации' : 'Prompt from this generation'}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{prompt.length.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')} {locale === 'ru' ? 'символов' : 'characters'}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyPrompt()}
                className="flex h-9 shrink-0 items-center gap-2 rounded-full border bg-card px-3 text-xs font-semibold text-brand transition active:scale-95"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? (locale === 'ru' ? 'Скопировано' : 'Copied') : (locale === 'ru' ? 'Копировать' : 'Copy')}
              </button>
            </div>

            <textarea
              id="repeat-prompt"
              rows={16}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setCopied(false)
              }}
              spellCheck={false}
              className="mt-2 w-full resize-y rounded-2xl border bg-card p-4 font-mono text-[12px] leading-relaxed outline-none focus:border-brand/40"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {prompt === template.prompt
                ? (locale === 'ru' ? 'Промпт не изменён — при запуске уйдёт точная исходная версия.' : 'Prompt unchanged — the exact original version will be sent.')
                : (locale === 'ru' ? 'Промпт изменён вручную — при запуске уйдёт эта версия.' : 'Prompt edited manually — this version will be sent.')}
            </p>
          </section>

          <section className="mt-5">
            <p className="text-sm font-semibold">{locale === 'ru' ? 'Референсы из успешной генерации' : 'References from the successful generation'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {locale === 'ru'
                ? 'Оставьте как есть или замените только нужное фото. Порядок @Image сохраняется.'
                : 'Keep them or replace only the photo you need. @Image order is preserved.'}
            </p>

            <div className="mt-3 grid gap-3">
              {template.references.map((reference, index) => {
                const replacement = replacements[index]
                const inputId = `repeat-reference-${index}`
                return (
                  <div key={reference.path} className="rounded-2xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{reference.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {replacement
                            ? (locale === 'ru' ? 'Будет использовано новое фото' : 'New photo will be used')
                            : (locale === 'ru' ? 'Исходное фото из успешного видео' : 'Original photo from the successful video')}
                        </p>
                      </div>
                      {replacement && <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">{locale === 'ru' ? 'Заменено' : 'Changed'}</span>}
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <img src={replacement?.url || reference.url} alt={reference.label} className="size-24 rounded-xl border object-cover" />
                      <div className="min-w-0 flex-1">
                        <input
                          id={inputId}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => handleReplacement(index, event)}
                        />
                        <label
                          htmlFor={inputId}
                          className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-background px-3 text-xs font-semibold text-brand transition active:scale-[0.98]"
                        >
                          {replacement ? <RefreshCw className="size-3.5" /> : <ImagePlus className="size-3.5" />}
                          {locale === 'ru' ? 'Заменить фото' : 'Replace photo'}
                        </label>
                        {replacement && (
                          <button
                            type="button"
                            onClick={() => setReplacements((current) => {
                              const next = { ...current }
                              delete next[index]
                              return next
                            })}
                            className="mt-2 h-9 w-full rounded-xl text-xs font-medium text-muted-foreground"
                          >
                            {locale === 'ru' ? 'Вернуть исходное' : 'Restore original'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="mt-5 rounded-2xl border bg-muted/35 p-3 text-xs text-muted-foreground">
            <p>{template.duration} sec · {template.resolution} · {template.aspectRatio} · {template.generateAudio ? (locale === 'ru' ? 'звук включён' : 'audio on') : (locale === 'ru' ? 'без звука' : 'audio off')}</p>
            <p className="mt-1">{locale === 'ru' ? `Заменено фотографий: ${changedCount}` : `Photos replaced: ${changedCount}`}</p>
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || prompt.trim().length < 5}
            className="brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45"
          >
            {generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating
              ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
              : (locale === 'ru' ? 'Создать с этой конфигурацией' : 'Generate with this configuration')}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
            {message || (locale === 'ru' ? 'До нажатия кнопки генерация не запускается и деньги не списываются.' : 'No generation starts and no video cost is incurred until you press the button.')}
          </p>
        </>
      )}

      {!loading && !template && message && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{message}</div>
      )}
    </BottomSheet>
  )
}
