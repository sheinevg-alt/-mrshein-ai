'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Clapperboard,
  FileAudio,
  FileImage,
  FileVideo,
  Paperclip,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
} from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

type Resolution = '480p' | '720p'
type Mode = 'generate' | 'edit'
type AssetKind = 'image' | 'video' | 'audio'
type ReferenceAsset = {
  id: string
  kind: AssetKind
  file: File
  url: string
  name: string
  duration?: number
}
type VideoUpload = { file: File; url: string; name: string; duration?: number }

const MAX_IMAGES = 30
const MAX_VIDEOS = 10
const MAX_AUDIOS = 10
const MAX_REFERENCES = 50
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const

function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'video/mp4' || file.type === 'video/quicktime') return 'video'
  if (['audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(file.type)) return 'audio'
  return null
}

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
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

async function mediaDuration(file: File, kind: 'video' | 'audio', url: string) {
  return new Promise<number | undefined>((resolve) => {
    const media = document.createElement(kind)
    media.preload = 'metadata'
    media.onloadedmetadata = () => resolve(Number.isFinite(media.duration) ? media.duration : undefined)
    media.onerror = () => resolve(undefined)
    media.src = url
  })
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()))
  return results
}

function formatDuration(value?: number) {
  return value && Number.isFinite(value) ? `${value.toFixed(1)}s` : ''
}

export function SeedanceSheet({ open, onClose, onGenerationStarted }: {
  open: boolean
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const omniInputRef = useRef<HTMLInputElement>(null)
  const editVideoInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const objectUrlsRef = useRef(new Set<string>())

  const [mode, setMode] = useState<Mode>('generate')
  const [prompt, setPrompt] = useState('')
  const [assets, setAssets] = useState<ReferenceAsset[]>([])
  const [sourceVideo, setSourceVideo] = useState<VideoUpload | undefined>()
  const [duration, setDuration] = useState(12)
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>('9:16')
  const [resolution, setResolution] = useState<Resolution>('480p')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')

  useEffect(() => () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
  }, [])

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

  const images = assets.filter((item) => item.kind === 'image')
  const videos = assets.filter((item) => item.kind === 'video')
  const audios = assets.filter((item) => item.kind === 'audio')
  const videoSeconds = videos.reduce((sum, item) => sum + Number(item.duration || 0), 0)
  const audioSeconds = audios.reduce((sum, item) => sum + Number(item.duration || 0), 0)
  const ready = prompt.trim().length >= 5 && !generating && (mode !== 'edit' || Boolean(sourceVideo))

  function tagFor(asset: ReferenceAsset) {
    const sameKindBefore = assets.slice(0, assets.findIndex((item) => item.id === asset.id) + 1)
      .filter((item) => item.kind === asset.kind).length
    return `@${asset.kind}${sameKindBefore}`
  }

  function insertPromptTag(tag: string) {
    const input = promptRef.current
    const start = input?.selectionStart ?? prompt.length
    const end = input?.selectionEnd ?? start
    const before = prompt.slice(0, start)
    const after = prompt.slice(end)
    const leftSpace = before && !/[\s\n]$/.test(before) ? ' ' : ''
    const rightSpace = after && !/^[\s\n]/.test(after) ? ' ' : ''
    const next = `${before}${leftSpace}${tag}${rightSpace}${after}`
    const caret = before.length + leftSpace.length + tag.length + rightSpace.length
    setPrompt(next)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  function rewriteTagsAfterRemoval(kind: AssetKind, removedIndex: number) {
    const expression = new RegExp(`@${kind}(\\d+)`, 'gi')
    setPrompt((current) => current.replace(expression, (match, raw) => {
      const value = Number(raw)
      if (value === removedIndex) return ''
      if (value > removedIndex) return `@${kind}${value - 1}`
      return match.toLowerCase()
    }).replace(/ {2,}/g, ' ').trim())
  }

  function removeAsset(asset: ReferenceAsset) {
    const sameKind = assets.filter((item) => item.kind === asset.kind)
    const removedIndex = sameKind.findIndex((item) => item.id === asset.id) + 1
    URL.revokeObjectURL(asset.url)
    objectUrlsRef.current.delete(asset.url)
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    rewriteTagsAfterRemoval(asset.kind, removedIndex)
    setMessage('')
  }

  async function handleOmniFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selected.length) return

    const next = [...assets]
    let currentImages = next.filter((item) => item.kind === 'image').length
    let currentVideos = next.filter((item) => item.kind === 'video').length
    let currentAudios = next.filter((item) => item.kind === 'audio').length
    let currentVideoSeconds = next.filter((item) => item.kind === 'video').reduce((sum, item) => sum + Number(item.duration || 0), 0)
    let currentAudioSeconds = next.filter((item) => item.kind === 'audio').reduce((sum, item) => sum + Number(item.duration || 0), 0)
    const rejected: string[] = []

    for (const original of selected) {
      if (next.length >= MAX_REFERENCES) {
        rejected.push(locale === 'ru' ? 'достигнут лимит 50 референсов' : '50-reference limit reached')
        break
      }

      const kind = kindOf(original)
      if (!kind) {
        rejected.push(original.name)
        continue
      }
      if (mode === 'edit' && kind !== 'image') {
        rejected.push(original.name)
        continue
      }
      if (kind === 'image' && currentImages >= MAX_IMAGES) { rejected.push(original.name); continue }
      if (kind === 'video' && currentVideos >= MAX_VIDEOS) { rejected.push(original.name); continue }
      if (kind === 'audio' && currentAudios >= MAX_AUDIOS) { rejected.push(original.name); continue }

      let file = original
      if (kind === 'image') {
        file = await compressImageIfNeeded(original)
        if (file.size > MAX_IMAGE_BYTES) { rejected.push(original.name); continue }
      }
      if (kind === 'video' && file.size > MAX_VIDEO_BYTES) { rejected.push(original.name); continue }
      if (kind === 'audio' && file.size > MAX_AUDIO_BYTES) { rejected.push(original.name); continue }

      const url = URL.createObjectURL(file)
      objectUrlsRef.current.add(url)
      const durationValue = kind === 'video' || kind === 'audio'
        ? await mediaDuration(file, kind, url)
        : undefined

      if ((kind === 'video' || kind === 'audio') && (!durationValue || durationValue < 2 || durationValue > 30)) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
        rejected.push(original.name)
        continue
      }
      if (kind === 'video' && currentVideoSeconds + Number(durationValue || 0) > 30.01) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
        rejected.push(original.name)
        continue
      }
      if (kind === 'audio' && currentAudioSeconds + Number(durationValue || 0) > 30.01) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
        rejected.push(original.name)
        continue
      }

      next.push({
        id: crypto.randomUUID(),
        kind,
        file,
        url,
        name: file.name,
        duration: durationValue,
      })
      if (kind === 'image') currentImages += 1
      if (kind === 'video') { currentVideos += 1; currentVideoSeconds += Number(durationValue || 0) }
      if (kind === 'audio') { currentAudios += 1; currentAudioSeconds += Number(durationValue || 0) }
    }

    setAssets(next)
    haptics.impact('light')
    setMessage(rejected.length
      ? (locale === 'ru'
          ? `Не добавлено: ${rejected.slice(0, 4).join(', ')}${rejected.length > 4 ? '…' : ''}. Проверьте формат, длительность и лимиты.`
          : `Not added: ${rejected.slice(0, 4).join(', ')}${rejected.length > 4 ? '…' : ''}. Check format, duration and limits.`)
      : '')
  }

  async function handleEditVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['video/mp4', 'video/quicktime'].includes(file.type) || file.size > MAX_VIDEO_BYTES) {
      setMessage(locale === 'ru' ? 'Для Edit нужен MP4/MOV до 100 МБ.' : 'Edit requires MP4/MOV up to 100 MB.')
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.add(url)
    const durationValue = await mediaDuration(file, 'video', url)
    if (!durationValue || durationValue < 4 || durationValue > 30) {
      URL.revokeObjectURL(url)
      objectUrlsRef.current.delete(url)
      setMessage(locale === 'ru' ? 'Исходное видео для Edit должно быть 4–30 сек.' : 'Edit source video must be 4–30 sec.')
      return
    }
    if (sourceVideo?.url) {
      URL.revokeObjectURL(sourceVideo.url)
      objectUrlsRef.current.delete(sourceVideo.url)
    }
    setSourceVideo({ file, url, name: file.name, duration: durationValue })
    setMessage('')
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    if (next === 'edit') {
      for (const asset of assets.filter((item) => item.kind !== 'image')) {
        URL.revokeObjectURL(asset.url)
        objectUrlsRef.current.delete(asset.url)
      }
      setAssets((current) => current.filter((item) => item.kind === 'image'))
      setPrompt((current) => current
        .replace(/@video\d+/gi, '')
        .replace(/@audio\d+/gi, '')
        .replace(/ {2,}/g, ' ')
        .trim())
    }
    setMode(next)
    setMessage('')
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

    setGenerating(true)
    setMessage('')
    setUploadProgress(locale === 'ru' ? 'Подготавливаю референсы…' : 'Preparing references…')

    try {
      const jobs = mode === 'edit'
        ? [
            ...(sourceVideo ? [{ kind: 'source' as const, file: sourceVideo.file }] : []),
            ...assets.filter((asset) => asset.kind === 'image').map((asset) => ({ kind: 'image' as const, file: asset.file })),
          ]
        : assets.map((asset) => ({ kind: asset.kind, file: asset.file }))

      let completed = 0
      const uploaded = await mapWithConcurrency(jobs, 3, async (job) => {
        const path = await uploadInputFile(job.file, initData)
        completed += 1
        setUploadProgress(locale === 'ru'
          ? `Загружено ${completed} из ${jobs.length}`
          : `Uploaded ${completed} of ${jobs.length}`)
        return { kind: job.kind, path }
      })

      const sourceVideoPath = uploaded.find((item) => item.kind === 'source')?.path || ''
      const referenceImagePaths = uploaded.filter((item) => item.kind === 'image').map((item) => item.path)
      const referenceVideoPaths = uploaded.filter((item) => item.kind === 'video').map((item) => item.path)
      const referenceAudioPaths = uploaded.filter((item) => item.kind === 'audio').map((item) => item.path)

      setUploadProgress(locale === 'ru' ? 'Запускаю Seedance 2.5…' : 'Starting Seedance 2.5…')
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
          ratio,
          generateAudio,
          sourceVideoPath,
          referenceImagePaths,
          referenceVideoPaths,
          referenceAudioPaths,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.ok && data?.jobId) {
        haptics.success()
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }

      if (data?.error === 'INSUFFICIENT_TOKENS') {
        setMessage(locale === 'ru'
          ? `Недостаточно токенов. Нужно ${Number(data.requiredTokens || quotedTokens || 0)}.`
          : `Not enough Tokens. Need ${Number(data.requiredTokens || quotedTokens || 0)}.`)
      } else {
        setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${String(data?.details || data?.error || 'GENERATION_FAILED').slice(0, 220)}`)
      }
      await refreshUser()
    } catch (error) {
      setMessage(`${locale === 'ru' ? 'Ошибка' : 'Error'}: ${String(error instanceof Error ? error.message : 'UNKNOWN_ERROR').slice(0, 220)}`)
    } finally {
      setGenerating(false)
      setUploadProgress('')
    }
  }

  return (
    <BottomSheet open title="Seedance 2.5" onClose={onClose}>
      <div className="mb-4 rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{locale === 'ru' ? 'Профессиональный режим' : 'Professional mode'}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === 'ru'
            ? 'Тренды остаются простыми. Здесь доступна полная работа с референсами Seedance.'
            : 'Trend templates stay simple. This workspace exposes full Seedance reference control.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1">
        <button type="button" onClick={() => switchMode('generate')} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${mode === 'generate' ? 'bg-card text-brand shadow-sm' : 'text-muted-foreground'}`}>
          <Sparkles className="size-4" />Omni Reference
        </button>
        <button type="button" onClick={() => switchMode('edit')} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${mode === 'edit' ? 'bg-card text-brand shadow-sm' : 'text-muted-foreground'}`}>
          <Clapperboard className="size-4" />Video Edit
        </button>
      </div>

      {mode === 'edit' && (
        <section className="mt-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">@video1 · {locale === 'ru' ? 'Исходное видео' : 'Source video'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">MP4 / MOV · 4–30 sec</p>
            </div>
            <Video className="size-5 text-brand" />
          </div>
          <input ref={editVideoInputRef} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void handleEditVideo(event)} className="sr-only" />
          {sourceVideo ? (
            <div className="mt-3 overflow-hidden rounded-xl border bg-black">
              <video src={sourceVideo.url} controls muted playsInline className="max-h-64 w-full object-contain" />
              <div className="flex items-center justify-between gap-2 bg-card px-3 py-2">
                <p className="min-w-0 truncate text-xs text-muted-foreground">{sourceVideo.name} · {formatDuration(sourceVideo.duration)}</p>
                <button type="button" onClick={() => editVideoInputRef.current?.click()} className="text-xs font-semibold text-brand">{locale === 'ru' ? 'Заменить' : 'Change'}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => editVideoInputRef.current?.click()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
              <Upload className="size-4" />{locale === 'ru' ? 'Добавить исходное видео' : 'Add source video'}
            </button>
          )}
        </section>
      )}

      <section className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{locale === 'ru' ? 'Референсы' : 'References'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === 'generate'
                ? (locale === 'ru' ? 'До 50 файлов одной лентой' : 'Up to 50 files in one tray')
                : (locale === 'ru' ? 'Для Edit — дополнительные изображения' : 'For Edit — additional images')}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{assets.length}/{mode === 'generate' ? MAX_REFERENCES : MAX_IMAGES}</span>
        </div>

        <input
          ref={omniInputRef}
          type="file"
          multiple
          accept={mode === 'generate'
            ? 'image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,audio/mpeg,audio/wav,.mp3,.wav,.mp4,.mov'
            : 'image/jpeg,image/png,image/webp,image/heic,image/heif'}
          onChange={(event) => void handleOmniFiles(event)}
          className="sr-only"
        />

        <button type="button" onClick={() => omniInputRef.current?.click()} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
          <Paperclip className="size-4" />
          {locale === 'ru' ? 'Прикрепить референсы' : 'Attach references'}
        </button>

        {mode === 'generate' && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-muted px-2.5 py-1">{locale === 'ru' ? 'Фото' : 'Images'} {images.length}/30</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{locale === 'ru' ? 'Видео' : 'Video'} {videos.length}/10 · {videoSeconds.toFixed(1)}/30s</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{locale === 'ru' ? 'Аудио' : 'Audio'} {audios.length}/10 · {audioSeconds.toFixed(1)}/30s</span>
          </div>
        )}

        {assets.length > 0 && (
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {assets.map((asset) => {
              const tag = tagFor(asset)
              return (
                <div key={asset.id} className="flex items-center gap-3 rounded-2xl border bg-card p-2.5">
                  {asset.kind === 'image' ? (
                    <img src={asset.url} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-brand">
                      {asset.kind === 'video' ? <FileVideo className="size-5" /> : <FileAudio className="size-5" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{asset.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button type="button" onClick={() => insertPromptTag(tag)} className="rounded-full bg-brand-tint px-2 py-1 font-mono text-[11px] font-bold text-brand">{tag}</button>
                      {asset.duration ? <span className="text-[11px] text-muted-foreground">{formatDuration(asset.duration)}</span> : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeAsset(asset)} className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground" aria-label={locale === 'ru' ? 'Удалить' : 'Remove'}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <label htmlFor="seedance-prompt" className="mt-5 block text-sm font-semibold">{locale === 'ru' ? 'Промпт' : 'Prompt'}</label>
      <div className="mt-2 rounded-2xl border bg-card p-3">
        <textarea
          ref={promptRef}
          id="seedance-prompt"
          rows={6}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={locale === 'ru'
            ? 'Опишите ролик. Нажимайте на теги @image1, @video1, @audio1 в списке выше, чтобы вставлять их в промпт.'
            : 'Describe the clip. Tap @image1, @video1 or @audio1 above to insert references into the prompt.'}
          className="w-full resize-none bg-transparent text-sm leading-6 outline-none"
        />
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3">
        {mode === 'generate' && (
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Формат' : 'Aspect ratio'}</span>
            <select value={ratio} onChange={(event) => setRatio(event.target.value as typeof ratio)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {RATIOS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        )}

        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Разрешение' : 'Resolution'}</span>
          <select value={resolution} onChange={(event) => setResolution(event.target.value as Resolution)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option value="480p">480p</option>
            <option value="720p">720p</option>
          </select>
        </label>

        {mode === 'generate' && (
          <label className="col-span-2 rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span className="flex items-center justify-between"><span>{locale === 'ru' ? 'Длительность' : 'Duration'}</span><strong className="text-foreground">{duration} sec</strong></span>
            <input type="range" min={4} max={30} step={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-3 w-full" />
          </label>
        )}

        <label className={`flex items-center justify-between rounded-2xl border bg-card p-3 text-xs ${mode === 'generate' ? 'col-span-2' : ''}`}>
          <span className="flex items-center gap-2"><Volume2 className="size-4 text-brand" />{locale === 'ru' ? 'Генерировать звук' : 'Generate audio'}</span>
          <input type="checkbox" checked={generateAudio} onChange={(event) => setGenerateAudio(event.target.checked)} className="size-4" />
        </label>
      </section>

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

      <button type="button" onClick={() => void generate()} disabled={!ready} className="brand-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45">
        <Sparkles className="size-4" />
        {generating
          ? (uploadProgress || (locale === 'ru' ? 'Запускаю…' : 'Starting…'))
          : quotedTokens != null && tokenBalance < quotedTokens
            ? (locale === 'ru' ? `Нужно ${quotedTokens} Tokens` : `Need ${quotedTokens} Tokens`)
            : mode === 'edit'
              ? `Video Edit · ${quotedTokens ?? '…'} Tokens`
              : `Omni Reference · ${quotedTokens ?? '…'} Tokens`}
      </button>

      {message && <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">{message}</p>}
      {mode === 'generate' && (
        <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
          {locale === 'ru'
            ? 'Поддерживается до 30 изображений, 10 видео и 10 аудио. Видео и аудио — по 2–30 сек, суммарно до 30 сек каждого типа.'
            : 'Supports up to 30 images, 10 videos and 10 audios. Video/audio clips are 2–30 sec each, with 30 sec total per media type.'}
        </p>
      )}
    </BottomSheet>
  )
}
