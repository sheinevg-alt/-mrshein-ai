'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Expand, ImagePlus, LoaderCircle, Video } from 'lucide-react'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { useI18n } from './i18n-provider'
import { BottomSheet } from './bottom-sheet'
import { useUserState } from './user-provider'

type MediaType = 'video' | 'image'

export type UpscaleSource = {
  mediaType: MediaType
  jobId?: string
  url?: string
  duration?: number
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
    throw new Error(String(signed?.error || 'UPLOAD_SIGN_FAILED'))
  }

  const body = new FormData()
  body.append('cacheControl', '3600')
  body.append('', file)
  const uploadResponse = await fetch(String(signed.signedUrl), {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body,
  })
  if (!uploadResponse.ok) throw new Error(`UPLOAD_FAILED_${uploadResponse.status}`)
  return String(signed.path)
}

export function UpscaleSheet({
  source,
  onClose,
  onGenerationStarted,
}: {
  source: UpscaleSource | null
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [duration, setDuration] = useState(source?.duration || 0)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [targetResolution, setTargetResolution] = useState<'720p' | '1080p' | '2k' | '4k'>('1080p')
  const [scale, setScale] = useState<2 | 4>(2)
  const [faceEnhance, setFaceEnhance] = useState(false)
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  const mediaType = source?.mediaType || 'video'
  const activeUrl = previewUrl || source?.url || ''
  const ready = Boolean(source?.jobId || file)

  useEffect(() => {
    setFile(null)
    setPreviewUrl('')
    setDuration(source?.duration || 0)
    setWidth(0)
    setHeight(0)
    setTargetResolution('1080p')
    setScale(2)
    setFaceEnhance(false)
    setMessage('')
  }, [source?.jobId, source?.mediaType, source?.url, source?.duration])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    const initData = getTelegramInitData()
    if (!initData || !ready) {
      setQuotedTokens(null)
      return
    }
    if (mediaType === 'video' && duration <= 0) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetch('/api/upscale/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          mediaType,
          sourceDuration: duration,
          targetResolution,
          scale,
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) {
          setQuotedTokens(Number(data.tokenCost || 0))
        }
      }).catch(() => undefined)
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ready, mediaType, duration, targetResolution, scale])

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setMessage('')
    event.target.value = ''
  }

  async function startUpscale() {
    const initData = getTelegramInitData()
    if (!initData || !ready) return
    setGenerating(true)
    setMessage(locale === 'ru' ? 'Запускаю улучшение…' : 'Starting upscale…')

    try {
      let sourcePath = ''
      if (!source?.jobId && file) sourcePath = await uploadFile(file, initData)

      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          mediaType,
          sourceJobId: source?.jobId || '',
          sourcePath,
          sourceDuration: duration,
          targetResolution,
          scale,
          faceEnhance,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.ok) {
        if (data?.error === 'INSUFFICIENT_TOKENS') {
          setMessage(locale === 'ru' ? `Недостаточно токенов. Нужно ${data.requiredTokens || quotedTokens || 0}.` : `Not enough tokens. Need ${data.requiredTokens || quotedTokens || 0}.`)
        } else {
          setMessage(locale === 'ru' ? `Не удалось запустить: ${String(data?.details || data?.error || 'ошибка').slice(0, 160)}` : `Could not start: ${String(data?.details || data?.error || 'error').slice(0, 160)}`)
        }
        return
      }

      haptics.success()
      await refreshUser()
      onGenerationStarted?.(String(data.jobId || ''))
    } catch {
      setMessage(locale === 'ru' ? 'Не удалось запустить улучшение.' : 'Could not start upscale.')
    } finally {
      setGenerating(false)
    }
  }

  const shortEdge = Math.min(width || 0, height || 0)
  const actualLabel = width > 0 && height > 0
    ? `${width}×${height}${duration > 0 && mediaType === 'video' ? ` · ${duration.toFixed(1)} сек` : ''}`
    : ''

  if (!source) return null

  return (
    <BottomSheet open title={mediaType === 'video' ? (locale === 'ru' ? 'Upscale видео' : 'Video Upscale') : (locale === 'ru' ? 'Upscale фото' : 'Image Upscale')} onClose={onClose}>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Expand className="size-4" />
          {mediaType === 'video' ? 'FlashVSR' : 'Real-ESRGAN'}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {mediaType === 'video'
            ? (locale === 'ru' ? 'Повышает разрешение готового видео без изменения сюжета и длительности.' : 'Raises finished-video resolution without changing the scene or duration.')
            : (locale === 'ru' ? 'Повышает разрешение изображения и восстанавливает мелкие детали.' : 'Raises image resolution and restores fine detail.')}
        </p>
      </div>

      {!source.jobId && (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept={mediaType === 'video' ? 'video/mp4,.mp4' : 'image/*'}
            className="sr-only"
            onChange={(event) => void chooseFile(event)}
          />
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
            {mediaType === 'video' ? <Video className="size-4" /> : <ImagePlus className="size-4" />}
            {file ? (locale === 'ru' ? 'Заменить файл' : 'Change file') : (locale === 'ru' ? 'Выбрать файл' : 'Choose file')}
          </button>
        </div>
      )}

      {activeUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border bg-black">
          {mediaType === 'video' ? (
            <video
              src={activeUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-[42dvh] w-full object-contain"
              onLoadedMetadata={(event) => {
                const el = event.currentTarget
                setDuration(el.duration || source.duration || 0)
                setWidth(el.videoWidth || 0)
                setHeight(el.videoHeight || 0)
                if (Math.min(el.videoWidth || 0, el.videoHeight || 0) >= 700) setTargetResolution('1080p')
              }}
            />
          ) : (
            <img
              src={activeUrl}
              alt=""
              className="max-h-[42dvh] w-full object-contain"
              onLoad={(event) => {
                setWidth(event.currentTarget.naturalWidth)
                setHeight(event.currentTarget.naturalHeight)
              }}
            />
          )}
        </div>
      )}

      {actualLabel && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {locale === 'ru' ? 'Исходный файл: ' : 'Source file: '}{actualLabel}
        </p>
      )}

      {mediaType === 'video' ? (
        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Качество после Upscale' : 'Upscale target'}</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(['720p', '1080p', '2k', '4k'] as const).map((value) => {
              const disabled = (value === '720p' && shortEdge >= 700)
              const selected = targetResolution === value
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTargetResolution(value)}
                  className={`h-10 rounded-xl border text-xs font-semibold ${selected ? 'border-brand bg-brand-tint text-brand' : 'bg-card'} disabled:opacity-35`}
                >
                  {value === '2k' ? '2K' : value === '4k' ? '4K' : value.toUpperCase()}
                </button>
              )
            })}
          </div>
          {shortEdge >= 700 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {locale === 'ru' ? 'Для 720p-источника: 1080p — мягкое улучшение, 2K — примерно ×2 по линейному размеру.' : 'For a 720p source: 1080p is a mild upgrade; 2K is roughly 2× in linear size.'}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Увеличение' : 'Scale'}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[2, 4].map((value) => (
              <button key={value} type="button" onClick={() => setScale(value as 2 | 4)} className={`h-11 rounded-xl border text-sm font-semibold ${scale === value ? 'border-brand bg-brand-tint text-brand' : 'bg-card'}`}>
                ×{value}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm">
            <span>{locale === 'ru' ? 'Улучшение лица' : 'Face enhancement'}</span>
            <input type="checkbox" checked={faceEnhance} onChange={(e) => setFaceEnhance(e.target.checked)} className="size-4" />
          </label>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Стоимость' : 'Price'}</p>
          <p className="mt-0.5 text-lg font-black">{quotedTokens == null ? '…' : `${quotedTokens} Tokens`}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{locale === 'ru' ? 'Баланс' : 'Balance'}</p>
          <p className="mt-0.5 text-sm font-semibold">{tokenBalance} Tokens</p>
        </div>
      </div>

      <button type="button" onClick={() => void startUpscale()} disabled={!ready || generating || quotedTokens == null} className="brand-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white disabled:opacity-45">
        {generating ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
        {generating
          ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
          : mediaType === 'video'
            ? (locale === 'ru' ? `Улучшить до ${targetResolution === '2k' ? '2K' : targetResolution === '4k' ? '4K' : targetResolution.toUpperCase()}` : `Upscale to ${targetResolution.toUpperCase()}`)
            : (locale === 'ru' ? `Увеличить ×${scale}` : `Upscale ×${scale}`)}
      </button>

      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
    </BottomSheet>
  )
}
