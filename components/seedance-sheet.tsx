'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, Clapperboard, ImagePlus, RefreshCw, Sparkles, Trash2, Upload, Video, Volume2 } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

type Resolution = '480p' | '720p'
type Mode = 'generate' | 'edit'
type ReferenceUpload = { file: File; url: string; name: string }
type VideoUpload = { file: File; url: string; name: string; duration?: number }

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 28_000_000) return file
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
      img.src = sourceUrl
    })
    const maxSide = 5000
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.9, 0.82, 0.74, 0.66]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (blob && blob.size <= 28_000_000) {
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

function ReferenceSlot({ index, value, disabled, onChange, onClear }: {
  index: number
  value?: ReferenceUpload
  disabled?: boolean
  onChange: (upload: ReferenceUpload) => void
  onClear: () => void
}) {
  const { locale } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

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
          <p className="text-sm font-semibold">@image{index}</p>
          <p className="text-[11px] text-muted-foreground">{locale === 'ru' ? `Референс ${index}` : `Reference ${index}`}</p>
        </div>
        {value && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><Check className="size-3.5" />{locale === 'ru' ? 'Добавлен' : 'Added'}</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" disabled={disabled} onChange={(event) => void handleFile(event)} className="sr-only" />
      {value ? (
        <div className="mt-3 flex items-center gap-3">
          <img src={value.url} alt={`Reference ${index}`} className="size-16 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{value.name}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium"><RefreshCw className="size-3.5" />{locale === 'ru' ? 'Заменить' : 'Change'}</button>
              <button type="button" onClick={onClear} className="flex size-8 items-center justify-center rounded-full border text-muted-foreground" aria-label={locale === 'ru' ? 'Удалить' : 'Remove'}><Trash2 className="size-3.5" /></button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/25 bg-brand-tint/40 text-sm font-medium text-brand disabled:cursor-not-allowed">
          <ImagePlus className="size-4" />{disabled ? (locale === 'ru' ? 'Сначала добавьте предыдущий' : 'Add the previous reference first') : (locale === 'ru' ? 'Добавить фото' : 'Add image')}
        </button>
      )}
    </div>
  )
}

export function SeedanceSheet({ open, onClose, onGenerationStarted }: {
  open: boolean
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const videoInputRef = useRef<HTMLInputElement>(null)
  const videoUrlRef = useRef<string | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const promptBackdropRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('generate')
  const [prompt, setPrompt] = useState('')
  const [references, setReferences] = useState<Array<ReferenceUpload | undefined>>([undefined, undefined, undefined])
  const [sourceVideo, setSourceVideo] = useState<VideoUpload | undefined>()
  const [duration, setDuration] = useState(12)
  const [resolution, setResolution] = useState<Resolution>('480p')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)

  useEffect(() => () => { if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current) }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetch('/api/generate/model/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'seedance-2-5',
          promptLength: prompt.length,
          settings: {
            mode,
            duration,
            sourceDuration: sourceVideo?.duration || duration,
            resolution,
            generateAudio,
          },
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setQuotedTokens(Number(data.tokenCost || 0))
      }).catch(() => undefined)
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, mode, duration, sourceVideo?.duration, resolution, generateAudio, prompt.length])

  if (!open) return null

  const ready = prompt.trim().length >= 5 && !generating && (mode !== 'edit' || Boolean(sourceVideo))

  function hasPromptTag(tag: string, value = prompt) {
    return value.toLowerCase().includes(tag.toLowerCase())
  }

  function ensurePromptTag(tag: string) {
    setPrompt((current) => {
      if (hasPromptTag(tag, current)) return current
      const clean = current.trimEnd()
      return clean ? `${clean}\n${tag} ` : `${tag} `
    })
  }

  function removePromptTag(tag: string) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const expression = new RegExp(`\\s*${escaped}\\b\\s*`, 'gi')
    setPrompt((current) => current.replace(expression, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
  }

  function insertPromptTag(tag: string) {
    if (hasPromptTag(tag)) {
      promptRef.current?.focus()
      return
    }
    const input = promptRef.current
    if (!input) { ensurePromptTag(tag); return }
    const start = input.selectionStart ?? prompt.length
    const end = input.selectionEnd ?? start
    const before = prompt.slice(0, start)
    const after = prompt.slice(end)
    const leftSpace = before && !/[\s\n]$/.test(before) ? ' ' : ''
    const rightSpace = after && !/^[\s\n]/.test(after) ? ' ' : ''
    const next = `${before}${leftSpace}${tag}${rightSpace}${after}`
    const caret = before.length + leftSpace.length + tag.length + rightSpace.length
    setPrompt(next)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(caret, caret)
    })
  }

  function setReference(index: number, upload: ReferenceUpload) {
    setReferences((current) => { const next = [...current]; next[index] = upload; return next })
  }

  function clearReference(index: number) {
    setReferences((current) => { const next = [...current]; for (let i = index; i < next.length; i += 1) next[i] = undefined; return next })
    for (let i = index; i < 3; i += 1) removePromptTag(`@image${i + 1}`)
  }

  async function handleVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      setMessage(locale === 'ru' ? 'Нужен MP4 или MOV.' : 'Use an MP4 or MOV file.')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setMessage(locale === 'ru' ? 'Видео больше 100 МБ.' : 'Video is larger than 100 MB.')
      return
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    const url = URL.createObjectURL(file)
    videoUrlRef.current = url
    const durationValue = await new Promise<number | undefined>((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : undefined)
      video.onerror = () => resolve(undefined)
      video.src = url
    })
    setSourceVideo({ file, url, name: file.name, duration: durationValue })
    if (prompt.trim()) ensurePromptTag('@video1')
    setMessage('')
    event.target.value = ''
  }

  async function uploadInputFile(file: File, initData: string) {
    const signResponse = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
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

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) {
      setMessage(locale === 'ru' ? 'Откройте инструмент внутри Telegram Mini App.' : 'Open this tool inside the Telegram Mini App.')
      return
    }
    if (!ready) return

    if (mode === 'edit' && sourceVideo?.duration && (sourceVideo.duration < 4 || sourceVideo.duration > 30)) {
      setMessage(locale === 'ru' ? 'Для Video Edit исходный ролик должен быть от 4 до 30 секунд.' : 'Video Edit source must be 4–30 seconds long.')
      return
    }
    if (mode === 'generate' && sourceVideo?.duration && (sourceVideo.duration < 2 || sourceVideo.duration > 30)) {
      setMessage(locale === 'ru' ? 'Видео-референс должен быть от 2 до 30 секунд.' : 'Reference video must be 2–30 seconds long.')
      return
    }

    setGenerating(true)
    setMessage(mode === 'edit'
      ? (locale === 'ru' ? 'Загружаю референсы и запускаю Video Edit…' : 'Uploading references and starting Video Edit…')
      : sourceVideo
        ? (locale === 'ru' ? 'Загружаю видео и фото-референсы…' : 'Uploading video and image references…')
        : (locale === 'ru' ? 'Запускаю Seedance 2.5…' : 'Starting Seedance 2.5…'))

    try {
      const sourceVideoPath = sourceVideo
        ? await uploadInputFile(sourceVideo.file, initData)
        : ''
      const referencePaths = await Promise.all(
        references.filter((reference): reference is ReferenceUpload => Boolean(reference?.file))
          .map((reference) => uploadInputFile(reference.file, initData)),
      )

      const response = await fetch('/api/generate/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          mode,
          prompt: prompt.trim(),
          duration,
          sourceDuration: sourceVideo?.duration || undefined,
          resolution,
          generateAudio,
          sourceVideoPath,
          referencePaths,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.ok && data?.jobId) {
        haptics.success()
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }
      if (response.status === 413) setMessage(locale === 'ru' ? 'Файл слишком большой для загрузки.' : 'A file is too large to upload.')
      else if (data?.error === 'PROMPT_TOO_LONG') setMessage(locale === 'ru' ? 'Промпт слишком длинный.' : 'The prompt is too long.')
      else if (data?.details) setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${String(data.details).slice(0, 220)}`)
      else setMessage(locale === 'ru' ? 'Не удалось запустить генерацию.' : 'Could not start generation.')
      await refreshUser()
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
      setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${messageText.slice(0, 220)}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <BottomSheet open title="Seedance 2.5" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1">
        <button type="button" onClick={() => { setMode('generate'); if (sourceVideo && prompt.trim()) ensurePromptTag('@video1'); setMessage('') }} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${mode === 'generate' ? 'bg-card text-brand shadow-sm' : 'text-muted-foreground'}`}><Sparkles className="size-4" />Omni Reference</button>
        <button type="button" onClick={() => { setMode('edit'); if (sourceVideo && prompt.trim()) ensurePromptTag('@video1'); setMessage('') }} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${mode === 'edit' ? 'bg-card text-brand shadow-sm' : 'text-muted-foreground'}`}><Clapperboard className="size-4" />Video Edit</button>
      </div>

      <div className="mt-4 rounded-2xl border border-brand/20 bg-brand-tint/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">@video1 · {mode === 'edit' ? (locale === 'ru' ? 'Исходное видео' : 'Source video') : (locale === 'ru' ? 'Видео-референс' : 'Reference video')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{mode === 'edit' ? 'MP4 / MOV · 4–30 sec' : 'MP4 / MOV · 2–30 sec'}</p>
          </div>
          <Video className="size-5 text-brand" />
        </div>
        <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void handleVideo(event)} className="sr-only" />
        {sourceVideo ? (
          <div className="mt-3 overflow-hidden rounded-xl border bg-black">
            <video src={sourceVideo.url} controls muted playsInline className="max-h-64 w-full object-contain" />
            <div className="flex items-center justify-between gap-2 bg-card px-3 py-2"><p className="min-w-0 truncate text-xs text-muted-foreground">{sourceVideo.name}{sourceVideo.duration ? ` · ${sourceVideo.duration.toFixed(1)}s` : ''}</p><button type="button" onClick={() => videoInputRef.current?.click()} className="shrink-0 text-xs font-semibold text-brand">{locale === 'ru' ? 'Заменить' : 'Change'}</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => videoInputRef.current?.click()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/25 bg-card text-sm font-semibold text-brand"><Upload className="size-4" />{locale === 'ru' ? 'Загрузить @video1' : 'Upload @video1'}</button>
        )}
        {mode === 'generate' && <p className="mt-2 text-[11px] text-muted-foreground">{locale === 'ru' ? 'Основной режим для трендов: видео, фото и другие референсы используются для создания нового ролика с сохранением движения, стиля и персонажей.' : 'Primary trend mode: video, image and other references guide a new clip while preserving motion, style and characters.'}</p>}
      </div>

      <label htmlFor="seedance-prompt" className="mt-5 block text-sm font-semibold">{locale === 'ru' ? 'Промпт' : 'Prompt'}</label>
      <div className="mt-2 overflow-hidden rounded-2xl border bg-card">
        {(sourceVideo || references.some(Boolean)) && (
          <div className="flex flex-wrap gap-2 border-b bg-muted/35 p-2">
            {sourceVideo && (
              <button
                type="button"
                onClick={() => insertPromptTag('@video1')}
                className={`flex h-10 max-w-full items-center gap-2 rounded-xl border px-2 text-xs font-semibold transition active:scale-[0.98] ${hasPromptTag('@video1') ? 'border-brand/35 bg-brand-tint text-brand' : 'border-dashed bg-card text-muted-foreground'}`}
                title={locale === 'ru' ? 'Нажмите, чтобы вставить @video1 в позицию курсора' : 'Tap to insert @video1 at the cursor'}
              >
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                  <video src={sourceVideo.url} muted playsInline className="size-full object-cover" />
                </span>
                <span>@video1</span>
                {hasPromptTag('@video1') && <Check className="size-3.5" />}
              </button>
            )}
            {references.map((reference, index) => reference ? (
              <button
                key={index}
                type="button"
                onClick={() => insertPromptTag(`@image${index + 1}`)}
                className={`flex h-10 max-w-full items-center gap-2 rounded-xl border px-2 text-xs font-semibold transition active:scale-[0.98] ${hasPromptTag(`@image${index + 1}`) ? 'border-brand/35 bg-brand-tint text-brand' : 'border-dashed bg-card text-muted-foreground'}`}
                title={locale === 'ru' ? `Нажмите, чтобы вставить @image${index + 1} в позицию курсора` : `Tap to insert @image${index + 1} at the cursor`}
              >
                <img src={reference.url} alt={`@image${index + 1}`} className="size-7 shrink-0 rounded-lg object-cover" />
                <span>@image{index + 1}</span>
                {hasPromptTag(`@image${index + 1}`) && <Check className="size-3.5" />}
              </button>
            ) : null)}
          </div>
        )}
        <div className="relative">
          <div
            ref={promptBackdropRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-4 text-sm leading-relaxed text-foreground"
          >
            {prompt.split(/(@(?:video|image)\d+)/gi).map((part, index) => {
              const normalized = part.toLowerCase()
              const imageMatch = normalized.match(/^@image(\d+)$/)
              const linked = normalized === '@video1'
                ? Boolean(sourceVideo)
                : imageMatch
                  ? Boolean(references[Number(imageMatch[1]) - 1])
                  : false

              if (!/^@(?:video|image)\d+$/i.test(part)) return <span key={index}>{part}</span>

              return (
                <span
                  key={index}
                  className={linked
                    ? 'rounded-md bg-brand text-white shadow-[0_0_0_1px_rgba(37,99,235,0.28)]'
                    : 'rounded-md bg-amber-50 text-amber-700 shadow-[0_0_0_1px_rgba(217,119,6,0.22)]'}
                >
                  {part}
                </span>
              )
            })}
            {prompt.endsWith('\n') ? ' ' : null}
          </div>
          <textarea
            ref={promptRef}
            id="seedance-prompt"
            rows={9}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onScroll={(event) => {
              if (!promptBackdropRef.current) return
              promptBackdropRef.current.scrollTop = event.currentTarget.scrollTop
              promptBackdropRef.current.scrollLeft = event.currentTarget.scrollLeft
            }}
            spellCheck={false}
            placeholder={mode === 'edit' ? (locale === 'ru' ? 'Например: Edit @video1. Replace the seated person with @image1 and the vehicle with @image2…' : 'Example: Edit @video1. Replace the seated person with @image1 and the vehicle with @image2…') : (locale === 'ru' ? 'Вставьте промпт. Можно использовать @video1, @image1, @image2…' : 'Paste a prompt. You can use @video1, @image1, @image2…')}
            className="relative z-10 w-full resize-y border-0 bg-transparent p-4 text-sm leading-relaxed text-transparent outline-none placeholder:text-muted-foreground selection:bg-brand/20"
            style={{ caretColor: 'var(--foreground)', color: 'transparent', WebkitTextFillColor: 'transparent' }}
          />
        </div>
      </div>
      {(sourceVideo || references.some(Boolean)) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {locale === 'ru' ? 'Референсы с ✓ уже связаны с промптом. Нажмите на миниатюру, чтобы вставить отсутствующий тег в позицию курсора.' : 'References with ✓ are linked in the prompt. Tap a thumbnail to insert a missing tag at the cursor.'}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {references.map((reference, index) => <ReferenceSlot key={index} index={index + 1} value={reference} disabled={index > 0 && !references[index - 1]} onChange={(upload) => { setReference(index, upload); if (prompt.trim()) ensurePromptTag(`@image${index + 1}`) }} onClear={() => clearReference(index)} />)}
      </div>

      <div className={`mt-5 grid gap-3 ${mode === 'edit' ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {mode !== 'edit' && (
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground"><span className="block font-medium">{locale === 'ru' ? 'Длительность' : 'Duration'}</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground">{Array.from({ length: 27 }, (_, index) => index + 4).map((seconds) => <option key={seconds} value={seconds}>{seconds} сек</option>)}</select></label>
        )}
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground"><span className="block font-medium">{locale === 'ru' ? 'Качество' : 'Quality'}</span><select value={resolution} onChange={(event) => setResolution((['480p', '720p'].includes(event.target.value) ? event.target.value : '480p') as Resolution)} className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground"><option value="480p">480p · test</option><option value="720p">720p</option></select></label>
      </div>
      {mode === 'edit' && <p className="mt-2 text-xs text-muted-foreground">{locale === 'ru' ? 'В Video Edit длительность и формат кадра автоматически сохраняются из @video1.' : 'Video Edit automatically preserves @video1 duration and aspect ratio.'}</p>}

      <button type="button" role="switch" aria-checked={generateAudio} onClick={() => { haptics.selection(); setGenerateAudio((value) => !value) }} className="mt-4 flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand"><Volume2 className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{locale === 'ru' ? 'Со звуком' : 'With sound'}</span><span className="block text-xs text-muted-foreground">{mode === 'edit' ? (locale === 'ru' ? 'Сохраняем и синхронизируем звук исходного видео по промпту.' : 'Keep/sync source audio according to the edit prompt.') : (locale === 'ru' ? 'Синхронный звук Seedance.' : 'Seedance synchronized audio.')}</span></span><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${generateAudio ? 'bg-brand' : 'bg-muted'}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${generateAudio ? 'left-6' : 'left-1'}`} /></span></button>

      <div className="mt-5 flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Стоимость запуска' : 'Generation price'}</p>
          <p className="mt-0.5 text-lg font-black">{quotedTokens == null ? '…' : `${quotedTokens} Tokens`}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Ваш баланс' : 'Your balance'}</p>
          <p className="mt-0.5 text-sm font-semibold">{tokenBalance} Tokens</p>
        </div>
      </div>

      <button type="button" onClick={() => void generate()} disabled={!ready} className="brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45">{generating ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating
        ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
        : quotedTokens != null && tokenBalance < quotedTokens
          ? (locale === 'ru' ? `Нужно ${quotedTokens} Tokens` : `Need ${quotedTokens} Tokens`)
          : mode === 'edit'
            ? (locale === 'ru' ? `Video Edit · ${quotedTokens ?? '…'} Tokens` : `Video Edit · ${quotedTokens ?? '…'} Tokens`)
            : (locale === 'ru' ? `Создать · ${quotedTokens ?? '…'} Tokens` : `Generate · ${quotedTokens ?? '…'} Tokens`)}</button>
      <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">{message || (locale === 'ru' ? 'Для первого теста оставь 480p.' : 'Use 480p for the first test.')}</p>
    </BottomSheet>
  )
}
