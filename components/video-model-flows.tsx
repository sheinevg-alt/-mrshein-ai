'use client'

import { useEffect, useState } from 'react'
import { ImagePlus, Video } from 'lucide-react'
import { getTelegramInitData } from '@/lib/telegram'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

type UploadItem = {
  file: File
  url: string
  name: string
  isVideo: boolean
}

async function uploadFile(file: File, initData: string) {
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
    throw new Error('UPLOAD_SIGN_FAILED')
  }
  const body = new FormData()
  body.append('cacheControl', '3600')
  body.append('', file)
  const uploadResponse = await fetch(String(signed.signedUrl), {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body,
  })
  if (!uploadResponse.ok) throw new Error('UPLOAD_FAILED')
  return String(signed.path)
}

function itemFromFile(file: File): UploadItem {
  return {
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    isVideo: file.type.startsWith('video/'),
  }
}

function MediaRow({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      {item.isVideo
        ? <video src={item.url} muted playsInline className="size-16 rounded-xl bg-black object-cover" />
        : <img src={item.url} alt="" className="size-16 rounded-xl object-cover" />}
      <span className="min-w-0 flex-1 truncate text-xs">{item.name}</span>
      <button type="button" onClick={onRemove} className="rounded-full border px-3 py-2 text-xs font-semibold">×</button>
    </div>
  )
}

function PriceBox({ quotedTokens, tokenBalance }: { quotedTokens: number | null; tokenBalance: number }) {
  const { locale } = useI18n()
  return (
    <div className="mt-5 flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
      <div>
        <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Стоимость' : 'Price'}</p>
        <p className="mt-0.5 text-lg font-black">{quotedTokens == null ? '…' : quotedTokens + ' Tokens'}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Баланс' : 'Balance'}</p>
        <p className="mt-0.5 text-sm font-semibold">{tokenBalance} Tokens</p>
      </div>
    </div>
  )
}

export function OmniFlashFlow({ onGenerationStarted, initialMode = 'text' }: { onGenerationStarted?: (jobId: string) => void; initialMode?: 'text' | 'keyframes' | 'references' | 'video-edit' }) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const [mode, setMode] = useState<'text' | 'keyframes' | 'references' | 'video-edit'>(initialMode)
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<UploadItem[]>([])
  const [video, setVideo] = useState<UploadItem | null>(null)
  const [duration, setDuration] = useState(4)
  const [resolution, setResolution] = useState('720p')
  const [ratio, setRatio] = useState('9:16')
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetch('/api/generate/model/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'omni-flash',
          promptLength: prompt.length,
          settings: { duration, resolution, ratio, omniMode: mode },
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setQuotedTokens(Number(data.tokenCost || 0))
      }).catch(() => undefined)
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [mode, prompt.length, duration, resolution, ratio])

  function switchMode(next: typeof mode) {
    images.forEach((item) => URL.revokeObjectURL(item.url))
    if (video) URL.revokeObjectURL(video.url)
    setImages([])
    setVideo(null)
    setMessage('')
    setMode(next)
  }

  function addImages(files: FileList | null) {
    if (!files) return
    const max = mode === 'keyframes' ? 2 : 7
    const remaining = Math.max(0, max - images.length)
    const next = Array.from(files).slice(0, remaining).map(itemFromFile)
    setImages((current) => current.concat(next).slice(0, max))
  }

  function addVideo(file?: File) {
    if (!file) return
    if (video) URL.revokeObjectURL(video.url)
    setVideo(itemFromFile(file))
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) return setMessage(locale === 'ru' ? 'Откройте Banana Zero внутри Telegram.' : 'Open Banana Zero inside Telegram.')
    if (prompt.trim().length < 2) return setMessage(locale === 'ru' ? 'Введите промпт.' : 'Enter a prompt.')
    if (mode === 'keyframes' && images.length < 1) return setMessage(locale === 'ru' ? 'Добавьте первый кадр.' : 'Add a first frame.')
    if (mode === 'references' && images.length < 1) return setMessage(locale === 'ru' ? 'Добавьте хотя бы один референс.' : 'Add at least one reference.')
    if (mode === 'video-edit' && !video) return setMessage(locale === 'ru' ? 'Добавьте исходное видео.' : 'Add a source video.')

    setGenerating(true)
    setMessage(locale === 'ru' ? 'Запускаю генерацию…' : 'Starting generation…')
    try {
      const referencePaths = await Promise.all(images.map((item) => uploadFile(item.file, initData)))
      const sourceVideoPath = video ? await uploadFile(video.file, initData) : ''
      const response = await fetch('/api/generate/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          toolId: 'omni-flash',
          prompt: prompt.trim(),
          referencePaths,
          sourceVideoPath,
          settings: { omniMode: mode, duration, resolution, ratio },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.jobId) {
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }
      setMessage(locale === 'ru' ? 'Не удалось запустить генерацию.' : 'Could not start generation.')
      await refreshUser()
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось загрузить материалы или запустить генерацию.' : 'Could not upload media or start generation.')
    } finally {
      setGenerating(false)
    }
  }

  const modes: Array<[typeof mode, string]> = [
    ['text', locale === 'ru' ? 'Текст → видео' : 'Text → Video'],
    ['keyframes', locale === 'ru' ? 'Первый / последний кадр' : 'First / Last Frame'],
    ['references', locale === 'ru' ? 'Референсы' : 'References'],
    ['video-edit', 'Video Edit'],
  ]

  return (
    <div>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <p className="text-sm font-semibold">Omni 1.1 Flash</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {locale === 'ru' ? 'Одна модель — четыре режима. Выберите задачу, и форма покажет только нужные поля.' : 'One model with four modes. Choose the job and only the needed fields appear.'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {modes.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            className={'rounded-2xl border px-3 py-2.5 text-xs font-semibold ' + (mode === value ? 'border-brand bg-brand-tint text-brand' : 'bg-card')}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Промпт' : 'Prompt'}</label>
      <textarea
        rows={5}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={locale === 'ru' ? 'Опишите, что должно происходить в видео…' : 'Describe what should happen in the video…'}
        className="mt-2 w-full resize-none rounded-2xl border bg-card p-4 text-sm"
      />

      {(mode === 'keyframes' || mode === 'references') && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              {mode === 'keyframes'
                ? (locale === 'ru' ? 'Первый кадр обязателен, последний — по желанию' : 'First frame required, last frame optional')
                : (locale === 'ru' ? 'До 7 изображений-референсов' : 'Up to 7 reference images')}
            </p>
            <label className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold">
              {locale === 'ru' ? 'Добавить' : 'Add'}
              <input
                type="file"
                accept="image/*"
                multiple={mode === 'references'}
                className="sr-only"
                onChange={(event) => addImages(event.target.files)}
              />
            </label>
          </div>
          <div className="mt-2 space-y-2">
            {images.map((item, index) => (
              <MediaRow
                key={item.url}
                item={item}
                onRemove={() => {
                  URL.revokeObjectURL(item.url)
                  setImages((current) => current.filter((_, i) => i !== index))
                }}
              />
            ))}
          </div>
        </div>
      )}

      {mode === 'video-edit' && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            {locale === 'ru' ? 'Исходное видео · рабочий отрезок до 10 секунд' : 'Source video · working segment up to 10 seconds'}
          </p>
          {video ? (
            <div className="mt-2">
              <MediaRow item={video} onRemove={() => { URL.revokeObjectURL(video.url); setVideo(null) }} />
            </div>
          ) : (
            <label className="mt-2 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
              <Video className="size-4" />
              {locale === 'ru' ? 'Добавить видео' : 'Add video'}
              <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="sr-only" onChange={(event) => addVideo(event.target.files?.[0])} />
            </label>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {mode !== 'video-edit' && (
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Длительность' : 'Duration'}</span>
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {[4, 6, 8, 10].map((value) => <option key={value} value={value}>{value} sec</option>)}
            </select>
          </label>
        )}
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Разрешение' : 'Resolution'}</span>
          <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="4k">4K</option>
          </select>
        </label>
        {mode !== 'video-edit' && (
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Формат' : 'Aspect'}</span>
            <select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              <option>9:16</option>
              <option>16:9</option>
            </select>
          </label>
        )}
      </div>

      <PriceBox quotedTokens={quotedTokens} tokenBalance={tokenBalance} />
      <button type="button" onClick={() => void generate()} disabled={generating} className="brand-gradient mt-4 h-12 w-full rounded-full text-sm font-semibold text-white disabled:opacity-45">
        {generating ? (locale === 'ru' ? 'Запускаю…' : 'Starting…') : (locale === 'ru' ? 'Создать · ' + (quotedTokens ?? '…') + ' Tokens' : 'Generate · ' + (quotedTokens ?? '…') + ' Tokens')}
      </button>
      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}

export function KlingOmniFlow({ onGenerationStarted }: { onGenerationStarted?: (jobId: string) => void }) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const [mode, setMode] = useState<'text' | 'image' | 'video-edit'>('text')
  const [prompt, setPrompt] = useState('')
  const [image, setImage] = useState<UploadItem | null>(null)
  const [video, setVideo] = useState<UploadItem | null>(null)
  const [duration, setDuration] = useState(5)
  const [ratio, setRatio] = useState('9:16')
  const [generateAudio, setGenerateAudio] = useState(false)
  const [keepOriginalSound, setKeepOriginalSound] = useState(true)
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetch('/api/generate/model/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'kling-v3-omni',
          promptLength: prompt.length,
          settings: { duration, ratio, generateAudio },
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setQuotedTokens(Number(data.tokenCost || 0))
      }).catch(() => undefined)
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [prompt.length, duration, ratio, generateAudio])

  async function chooseImage(file?: File) {
    if (!file) return
    if (image) URL.revokeObjectURL(image.url)
    setImage(itemFromFile(file))
  }

  function chooseVideo(file?: File) {
    if (!file) return
    if (video) URL.revokeObjectURL(video.url)
    setVideo(itemFromFile(file))
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) return setMessage(locale === 'ru' ? 'Откройте Banana Zero внутри Telegram.' : 'Open Banana Zero inside Telegram.')
    if (prompt.trim().length < 2) return setMessage(locale === 'ru' ? 'Введите промпт.' : 'Enter a prompt.')
    if (mode === 'image' && !image) return setMessage(locale === 'ru' ? 'Добавьте фото.' : 'Add an image.')
    if (mode === 'video-edit' && !video) return setMessage(locale === 'ru' ? 'Добавьте видео.' : 'Add a video.')

    setGenerating(true)
    try {
      const referencePaths = image ? [await uploadFile(image.file, initData)] : []
      const sourceVideoPath = video ? await uploadFile(video.file, initData) : ''
      const response = await fetch('/api/generate/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          toolId: 'kling-v3-omni',
          prompt: prompt.trim(),
          referencePaths,
          sourceVideoPath,
          settings: { duration, ratio, generateAudio, keepOriginalSound },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.jobId) {
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }
      setMessage(locale === 'ru' ? 'Не удалось запустить генерацию.' : 'Could not start generation.')
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось загрузить материалы или запустить генерацию.' : 'Could not upload media or start generation.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <p className="text-sm font-semibold">Kling V3 Omni</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {locale === 'ru' ? 'Текст, изображение или исходное видео. В Video Edit можно сохранить исходный звук.' : 'Text, image or source video. Video Edit can keep original sound.'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['text', locale === 'ru' ? 'Текст' : 'Text'],
          ['image', locale === 'ru' ? 'Фото' : 'Image'],
          ['video-edit', 'Video Edit'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setMode(value as typeof mode)} className={'rounded-2xl border px-2 py-2.5 text-[11px] font-semibold ' + (mode === value ? 'border-brand bg-brand-tint text-brand' : 'bg-card')}>
            {label}
          </button>
        ))}
      </div>

      <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-4 w-full resize-none rounded-2xl border bg-card p-4 text-sm" placeholder={locale === 'ru' ? 'Опишите результат…' : 'Describe the result…'} />

      {mode === 'image' && (
        image ? <div className="mt-3"><MediaRow item={image} onRemove={() => { URL.revokeObjectURL(image.url); setImage(null) }} /></div>
          : <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand"><ImagePlus className="size-4" />{locale === 'ru' ? 'Добавить фото' : 'Add image'}<input type="file" accept="image/*" className="sr-only" onChange={(event) => void chooseImage(event.target.files?.[0])} /></label>
      )}
      {mode === 'video-edit' && (
        video ? <div className="mt-3"><MediaRow item={video} onRemove={() => { URL.revokeObjectURL(video.url); setVideo(null) }} /></div>
          : <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand"><Video className="size-4" />{locale === 'ru' ? 'Добавить видео' : 'Add video'}<input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="sr-only" onChange={(event) => chooseVideo(event.target.files?.[0])} /></label>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Длительность' : 'Duration'}</span>
          <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            {Array.from({ length: 13 }, (_, index) => index + 3).map((value) => <option key={value} value={value}>{value} sec</option>)}
          </select>
        </label>
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Формат' : 'Aspect'}</span>
          <select value={ratio} onChange={(event) => setRatio(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option>9:16</option><option>16:9</option><option>1:1</option>
          </select>
        </label>
        {mode === 'video-edit' ? (
          <label className="col-span-2 flex items-center justify-between rounded-2xl border bg-card p-3 text-xs">
            <span>{locale === 'ru' ? 'Сохранить исходный звук' : 'Keep original sound'}</span>
            <input type="checkbox" checked={keepOriginalSound} onChange={(event) => setKeepOriginalSound(event.target.checked)} className="size-4" />
          </label>
        ) : (
          <label className="col-span-2 flex items-center justify-between rounded-2xl border bg-card p-3 text-xs">
            <span>{locale === 'ru' ? 'Генерировать звук' : 'Generate audio'}</span>
            <input type="checkbox" checked={generateAudio} onChange={(event) => setGenerateAudio(event.target.checked)} className="size-4" />
          </label>
        )}
      </div>

      <PriceBox quotedTokens={quotedTokens} tokenBalance={tokenBalance} />
      <button type="button" onClick={() => void generate()} disabled={generating} className="brand-gradient mt-4 h-12 w-full rounded-full text-sm font-semibold text-white disabled:opacity-45">
        {generating ? (locale === 'ru' ? 'Запускаю…' : 'Starting…') : (locale === 'ru' ? 'Создать · ' + (quotedTokens ?? '…') + ' Tokens' : 'Generate · ' + (quotedTokens ?? '…') + ' Tokens')}
      </button>
      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}

export function KlingMotionFlow({ onGenerationStarted }: { onGenerationStarted?: (jobId: string) => void }) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const [image, setImage] = useState<UploadItem | null>(null)
  const [video, setVideo] = useState<UploadItem | null>(null)
  const [resolution, setResolution] = useState('720p')
  const [orientation, setOrientation] = useState<'video' | 'image'>('video')
  const [duration, setDuration] = useState(5)
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetch('/api/generate/model/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'kling-motion-control',
          promptLength: 0,
          settings: { duration, resolution },
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) setQuotedTokens(Number(data.tokenCost || 0))
      }).catch(() => undefined)
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [duration, resolution])

  function chooseImage(file?: File) {
    if (!file) return
    if (image) URL.revokeObjectURL(image.url)
    setImage(itemFromFile(file))
  }

  async function chooseVideo(file?: File) {
    if (!file) return
    if (video) URL.revokeObjectURL(video.url)
    setVideo(itemFromFile(file))
    const temp = URL.createObjectURL(file)
    try {
      const seconds = await new Promise<number>((resolve) => {
        const el = document.createElement('video')
        el.preload = 'metadata'
        el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 5)
        el.onerror = () => resolve(5)
        el.src = temp
      })
      setDuration(Math.max(1, Math.min(30, Math.ceil(seconds))))
    } finally {
      URL.revokeObjectURL(temp)
    }
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) return setMessage(locale === 'ru' ? 'Откройте Banana Zero внутри Telegram.' : 'Open Banana Zero inside Telegram.')
    if (!image || !video) return setMessage(locale === 'ru' ? 'Нужны фото персонажа и видео движения.' : 'Character image and motion video are required.')
    setGenerating(true)
    try {
      const [imagePath, sourceVideoPath] = await Promise.all([
        uploadFile(image.file, initData),
        uploadFile(video.file, initData),
      ])
      const response = await fetch('/api/generate/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          toolId: 'kling-motion-control',
          prompt: '',
          referencePaths: [imagePath],
          sourceVideoPath,
          settings: { duration, resolution, characterOrientation: orientation },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.jobId) {
        await refreshUser()
        onGenerationStarted?.(String(data.jobId))
        return
      }
      setMessage(locale === 'ru' ? 'Не удалось запустить перенос движения.' : 'Could not start motion transfer.')
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось загрузить материалы или запустить генерацию.' : 'Could not upload media or start generation.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <p className="text-sm font-semibold">Kling Motion Control</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {locale === 'ru' ? 'Фото определяет персонажа, видео — движение. Для персонажа лучше фото в полный рост.' : 'The image defines the character and the video defines the motion. A full-body character image works best.'}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {image ? (
          <MediaRow item={image} onRemove={() => { URL.revokeObjectURL(image.url); setImage(null) }} />
        ) : (
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
            <ImagePlus className="size-4" />{locale === 'ru' ? 'Фото персонажа' : 'Character image'}
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => chooseImage(event.target.files?.[0])} />
          </label>
        )}
        {video ? (
          <MediaRow item={video} onRemove={() => { URL.revokeObjectURL(video.url); setVideo(null) }} />
        ) : (
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
            <Video className="size-4" />{locale === 'ru' ? 'Видео движения' : 'Motion video'}
            <input type="file" accept="video/mp4,video/quicktime,.mp4,.mov" className="sr-only" onChange={(event) => void chooseVideo(event.target.files?.[0])} />
          </label>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Разрешение' : 'Resolution'}</span>
          <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option>720p</option><option>1080p</option>
          </select>
        </label>
        <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Ориентация' : 'Orientation'}</span>
          <select value={orientation} onChange={(event) => setOrientation(event.target.value as 'video' | 'image')} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option value="video">{locale === 'ru' ? 'как в видео' : 'follow video'}</option>
            <option value="image">{locale === 'ru' ? 'как на фото' : 'follow image'}</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{locale === 'ru' ? 'Длительность берётся из motion-видео: примерно ' + duration + ' сек.' : 'Duration follows the motion video: about ' + duration + 's.'}</p>
      <PriceBox quotedTokens={quotedTokens} tokenBalance={tokenBalance} />
      <button type="button" onClick={() => void generate()} disabled={generating || !image || !video} className="brand-gradient mt-4 h-12 w-full rounded-full text-sm font-semibold text-white disabled:opacity-45">
        {generating ? (locale === 'ru' ? 'Запускаю…' : 'Starting…') : (locale === 'ru' ? 'Перенести движение · ' + (quotedTokens ?? '…') + ' Tokens' : 'Transfer motion · ' + (quotedTokens ?? '…') + ' Tokens')}
      </button>
      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
