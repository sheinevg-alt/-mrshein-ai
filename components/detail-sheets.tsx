'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, FileAudio, ImagePlus, RefreshCw, Sparkles, Trash2, Video, Volume2 } from 'lucide-react'
import { getCategory, getToolTokens, localize, tools, type Tool, type Trend, type TrendInput } from '@/lib/data'
import { getTelegramInitData, haptics } from '@/lib/telegram'
import { BottomSheet } from './bottom-sheet'
import { useI18n } from './i18n-provider'
import { TokenCost } from './tokens'
import { useUserState } from './user-provider'
import { KlingMotionFlow, KlingOmniFlow, OmniFlashFlow } from './video-model-flows'

type FileUpload = { url: string; isVideo: boolean; isAudio: boolean; name: string; isDefault?: boolean; file?: File }
type InputValue = FileUpload | string

const TTS_VOICES = {
  female: { id: 'EXAVITQu4vr4xnSDxMaL', ru: 'Женский', en: 'Female' },
  male: { id: 'JBFqnCBsd6RMkjVDRZzb', ru: 'Мужской', en: 'Male' },
} as const

type TtsVoice = keyof typeof TTS_VOICES

const QUICK_TOOL_CONFIG: Record<string, {
  targetId: string
  presetRu?: string
  presetEn?: string
  omniMode?: 'text' | 'video-edit'
  generationMode?: 'text' | 'image'
}> = {
  'text-to-video': { targetId: 'omni-flash', omniMode: 'text' },
  'image-to-video': { targetId: 'kling-v3', generationMode: 'image' },
  'video-remix': { targetId: 'omni-flash', omniMode: 'video-edit' },

  'text-to-image': { targetId: 'nano-banana-2' },
  'remove-bg': {
    targetId: 'gpt-image-2-5',
    presetRu: 'Удалить фон с загруженного изображения. Полностью сохранить исходный объект, лицо, волосы, одежду, пропорции, края и мелкие детали. Не менять внешний вид объекта. Результат — объект на прозрачном фоне, без теней и новых элементов.',
    presetEn: 'Remove the background from the uploaded image. Preserve the original subject, face, hair, clothing, proportions, edges and fine details exactly. Do not redesign the subject. Return the subject on a transparent background with no added elements.',
  },
  'style-transfer': {
    targetId: 'nano-banana-2',
    presetRu: 'Сохрани человека или основной объект с исходного фото максимально точно: лицо, волосы, телосложение, пропорции и позу. Измени только визуальный стиль изображения на: [опиши желаемый стиль].',
    presetEn: 'Preserve the person or main subject from the uploaded image as accurately as possible: face, hair, body, proportions and pose. Change only the visual style to: [describe the desired style].',
  },
  'inpaint': {
    targetId: 'nano-banana-2',
    presetRu: 'Измени только указанную часть изображения: [опиши, что заменить или исправить]. Всё остальное — лицо, позу, одежду, фон, композицию, освещение и детали — оставить без изменений.',
    presetEn: 'Change only this requested part of the image: [describe what to replace or fix]. Keep everything else — face, pose, clothing, background, composition, lighting and details — unchanged.',
  },

  'text-to-speech': { targetId: 'elevenlabs-tts' },
  'music-gen': { targetId: 'suno-v5' },

  'ai-chat': { targetId: 'gpt-6-sol' },
  'copywriter': {
    targetId: 'gpt-6-luna',
    presetRu: 'Напиши готовый текст по задаче ниже. Сделай его естественным, современным и без канцелярита. Задача: ',
    presetEn: 'Write polished copy for the task below. Keep it natural, modern and concise. Task: ',
  },
  'translator': {
    targetId: 'gpt-6-luna',
    presetRu: 'Переведи текст на [нужный язык]. Сохрани смысл, тон и естественное звучание, не переводи дословно там, где это звучит неестественно. Текст: ',
    presetEn: 'Translate the text into [target language]. Preserve meaning and tone and make it sound natural rather than overly literal. Text: ',
  },
  'summarizer': {
    targetId: 'gpt-6-luna',
    presetRu: 'Сделай короткое структурированное саммари следующего текста. Сохрани ключевые факты, цифры и выводы, не добавляй того, чего нет в исходнике. Текст: ',
    presetEn: 'Create a concise structured summary of the following text. Preserve key facts, numbers and conclusions and do not invent anything. Text: ',
  },
  'rewriter': {
    targetId: 'gpt-6-luna',
    presetRu: 'Перепиши текст яснее и естественнее, сохранив исходный смысл и факты. Убери повторы и канцелярит. Текст: ',
    presetEn: 'Rewrite the text to be clearer and more natural while preserving the original meaning and facts. Remove repetition and stiffness. Text: ',
  },
  'hashtags': {
    targetId: 'gpt-6-luna',
    presetRu: 'Подбери релевантные хэштеги и короткую подпись для публикации по теме ниже. Не используй случайные высокочастотные теги. Тема: ',
    presetEn: 'Create relevant hashtags and a short social caption for the topic below. Avoid random high-volume tags. Topic: ',
  },
  'email-writer': {
    targetId: 'gpt-6-luna',
    presetRu: 'Напиши профессиональное, короткое и человеческое письмо по задаче ниже. Задача: ',
    presetEn: 'Write a professional, concise and natural email for the task below. Task: ',
  },
  'idea-gen': {
    targetId: 'gpt-6-sol',
    presetRu: 'Предложи сильные идеи по задаче ниже. Идеи должны заметно отличаться друг от друга и быть применимыми на практике. Задача: ',
    presetEn: 'Generate strong ideas for the task below. Make the ideas meaningfully different and practical. Task: ',
  },
}

export function ToolSheet({
  tool,
  onClose,
  onGenerationStarted,
}: {
  tool: Tool | null
  onClose: () => void
  onGenerationStarted?: (jobId: string) => void
}) {
  const { t, locale } = useI18n()
  if (!tool) return null

  const quickConfig = QUICK_TOOL_CONFIG[tool.id]
  if (tool.kind === 'model' || quickConfig) {
    const target = quickConfig ? tools.find((item) => item.id === quickConfig.targetId) : tool
    if (!target) return null
    const effectiveTool: Tool = quickConfig
      ? { ...target, name: tool.name, description: tool.description }
      : target
    const preset = quickConfig ? (locale === 'ru' ? quickConfig.presetRu : quickConfig.presetEn) : undefined
    const flow = target.id === 'omni-flash'
      ? <OmniFlashFlow onGenerationStarted={onGenerationStarted} initialMode={quickConfig?.omniMode || 'text'} />
      : target.id === 'kling-v3-omni'
        ? <KlingOmniFlow onGenerationStarted={onGenerationStarted} />
        : target.id === 'kling-motion-control'
          ? <KlingMotionFlow onGenerationStarted={onGenerationStarted} />
          : <ModelToolFlow
              tool={effectiveTool}
              onGenerationStarted={onGenerationStarted}
              initialPrompt={preset}
              initialGenerationMode={quickConfig?.generationMode}
            />
    return (
      <BottomSheet open title={localize(tool.name, locale)} onClose={onClose}>
        {flow}
      </BottomSheet>
    )
  }

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
      <p className="mt-5 rounded-2xl bg-brand-tint/60 px-4 py-3 text-sm text-muted-foreground">
        {locale === 'ru' ? 'Этот быстрый инструмент подключается следующим этапом. AI-модели выше уже получают рабочие панели.' : 'This quick tool is next in the rollout. AI models above already have working panels.'}
      </p>
    </BottomSheet>
  )
}

function ModelToolFlow({
  tool,
  onGenerationStarted,
  initialPrompt = '',
  initialGenerationMode = 'text',
}: {
  tool: Tool
  onGenerationStarted?: (jobId: string) => void
  initialPrompt?: string
  initialGenerationMode?: 'text' | 'image'
}) {
  const { locale } = useI18n()
  const { tokenBalance, refreshUser } = useUserState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [reference, setReference] = useState<FileUpload | null>(null)
  const [duration, setDuration] = useState(tool.id === 'omni-flash' ? 4 : 5)
  const [resolution, setResolution] = useState(tool.category === 'video' ? '720p' : '2k')
  const [ratio, setRatio] = useState(tool.category === 'image' ? '1:1' : '9:16')
  const [quality, setQuality] = useState('medium')
  const [mode, setMode] = useState('std')
  const [generationMode, setGenerationMode] = useState<'text' | 'image'>(initialGenerationMode)
  const [sunoVersion, setSunoVersion] = useState('chirp-v5-5')
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>('female')
  const [generateAudio, setGenerateAudio] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState('medium')
  const [quotedTokens, setQuotedTokens] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [textResult, setTextResult] = useState('')
  const [audioDataUrl, setAudioDataUrl] = useState('')
  const [savingAudio, setSavingAudio] = useState(false)
  const [audioSaveError, setAudioSaveError] = useState('')

  const isVideo = tool.category === 'video'
  const isImage = tool.category === 'image'
  const isText = tool.category === 'text'
  const isAudio = tool.category === 'audio'
  const wantsVideoInput = tool.id === 'kling-audio'
  const wantsImageInput = isImage || (tool.id === 'kling-v3' && generationMode === 'image')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetch('/api/generate/model/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          promptLength: prompt.length,
          settings: { duration, resolution, ratio, quality, mode, generateAudio, reasoningEffort, sunoVersion, voiceId: TTS_VOICES[ttsVoice].id },
        }),
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok) {
          setQuotedTokens(Number(data.tokenCost || 0))
        }
      }).catch(() => undefined)
    }, 200)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [tool.id, prompt.length, duration, resolution, ratio, quality, mode, generateAudio, reasoningEffort, sunoVersion, ttsVoice])

  useEffect(() => () => {
    if (reference?.url) URL.revokeObjectURL(reference.url)
  }, [reference])

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    const file = selected.type.startsWith('image/') ? await compressImageIfNeeded(selected) : selected
    if (reference?.url) URL.revokeObjectURL(reference.url)
    setReference({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isVideo: file.type.startsWith('video/'),
      isAudio: false,
    })
    setMessage('')
    event.target.value = ''
  }

  async function generate() {
    const initData = getTelegramInitData()
    if (!initData) {
      setMessage(locale === 'ru' ? 'Откройте Banana Zero внутри Telegram Mini App.' : 'Open Banana Zero inside Telegram Mini App.')
      return
    }
    if (prompt.trim().length < 2) {
      setMessage(locale === 'ru' ? 'Введите запрос.' : 'Enter a prompt.')
      return
    }

    setGenerating(true)
    setMessage(locale === 'ru' ? 'Запускаю генерацию…' : 'Starting generation…')
    setTextResult('')
    setAudioDataUrl('')

    try {
      let referencePaths: string[] = []
      let sourceVideoPath = ''
      if (reference?.file) {
        const path = await uploadTrendInputFile(reference.file, initData)
        if (reference.isVideo) sourceVideoPath = path
        else referencePaths = [path]
      }

      const response = await fetch('/api/generate/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({
          toolId: tool.id,
          prompt: prompt.trim(),
          referencePaths,
          sourceVideoPath,
          settings: { duration, resolution, ratio, quality, mode, generateAudio, reasoningEffort, sunoVersion, voiceId: TTS_VOICES[ttsVoice].id },
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data?.ok) {
        haptics.success()
        await refreshUser()
        if (data.status === 'completed' && typeof data.text === 'string') {
          setTextResult(data.text)
          setMessage(locale === 'ru' ? 'Готово.' : 'Done.')
          return
        }
        if (data.status === 'completed' && typeof data.audioDataUrl === 'string') {
          setAudioDataUrl(data.audioDataUrl)
          setMessage(locale === 'ru' ? 'Озвучка готова. Сохраните её сейчас.' : 'Voice-over is ready. Save it now.')
          return
        }
        if (data.jobId) {
          onGenerationStarted?.(String(data.jobId))
          return
        }
      }

      if (data?.error === 'INSUFFICIENT_TOKENS') {
        setMessage(locale === 'ru'
          ? `Недостаточно токенов. Для этой настройки нужно ${Number(data.requiredTokens || quotedTokens || 0)}.`
          : `Not enough Tokens. This setup needs ${Number(data.requiredTokens || quotedTokens || 0)}.`)
      } else {
        setMessage(locale === 'ru'
          ? `Не удалось запустить: ${String(data?.details || data?.error || 'ошибка').slice(0, 180)}`
          : `Could not start: ${String(data?.details || data?.error || 'error').slice(0, 180)}`)
      }
      await refreshUser()
    } catch (error) {
      setMessage(locale === 'ru' ? 'Не удалось запустить генерацию.' : 'Could not start generation.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveTtsAudio() {
    if (!audioDataUrl || savingAudio) return

    setSavingAudio(true)
    setAudioSaveError('')
    try {
      const match = audioDataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s)
      if (!match) throw new Error('INVALID_AUDIO_DATA')

      const mimeType = match[1] || 'audio/mpeg'
      const encoded = match[3] || ''
      let bytes: Uint8Array

      if (match[2]) {
        const binary = atob(encoded)
        bytes = new Uint8Array(binary.length)
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(encoded))
      }

      const extension = mimeType.includes('wav') ? 'wav'
        : mimeType.includes('ogg') ? 'ogg'
          : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
            : 'mp3'
      const filename = `Banana-Zero-voice.${extension}`
      const blob = new Blob([bytes], { type: mimeType })
      const file = new File([blob], filename, { type: mimeType })
      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean
        share?: (data: ShareData) => Promise<void>
      }

      // Telegram on iPhone does not reliably honor <a download> for data: URLs.
      // The native iOS share sheet reliably offers "Save to Files".
      if (shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))) {
        try {
          await shareNavigator.share({ files: [file], title: filename })
          haptics.success()
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        anchor.rel = 'noopener'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()

        // iOS WebViews may ignore the download attribute. Opening the Blob gives
        // the user a native preview/share fallback instead of a dead button.
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          window.setTimeout(() => window.open(objectUrl, '_blank'), 150)
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
        } else {
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
        }
      } catch {
        URL.revokeObjectURL(objectUrl)
        throw new Error('AUDIO_SAVE_FAILED')
      }

      haptics.success()
    } catch {
      setAudioSaveError(locale === 'ru'
        ? 'Не удалось сохранить MP3. Попробуйте ещё раз.'
        : 'Could not save the MP3. Please try again.')
    } finally {
      setSavingAudio(false)
    }
  }

  const durationOptions = tool.id === 'omni-flash'
    ? [4, 6, 8, 10]
    : tool.id === 'kling-v3'
      ? Array.from({ length: 13 }, (_, index) => index + 3)
      : [3, 4, 5, 6, 7, 8, 9, 10]

  const videoAspectOptions = tool.id === 'omni-flash'
    ? ['9:16', '16:9']
    : tool.id === 'kling-v3'
      ? ['9:16', '16:9', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9']
      : ['9:16', '16:9', '1:1']

  return (
    <div>
      <div className="rounded-2xl border border-brand/20 bg-brand-tint/50 p-4">
        <p className="text-sm font-semibold">{localize(tool.name, locale)}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{localize(tool.description, locale)}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-card px-2.5 py-1">{locale === 'ru' ? 'Доступно всем' : 'Available to everyone'}</span>
        </div>
      </div>

      {tool.id === 'kling-v3' && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Режим' : 'Mode'}</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1">
            <button type="button" onClick={() => { setGenerationMode('text'); setReference(null) }} className={'rounded-xl px-3 py-2 text-xs font-semibold ' + (generationMode === 'text' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {locale === 'ru' ? 'Текст → видео' : 'Text → Video'}
            </button>
            <button type="button" onClick={() => setGenerationMode('image')} className={'rounded-xl px-3 py-2 text-xs font-semibold ' + (generationMode === 'image' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {locale === 'ru' ? 'Фото → видео' : 'Image → Video'}
            </button>
          </div>
        </div>
      )}

      {tool.id === 'suno-v5' && (
        <label className="mt-4 block rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Версия Suno через текущий API' : 'Suno version via current API'}</span>
          <select value={sunoVersion} onChange={(event) => setSunoVersion(event.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            <option value="chirp-v5-5">V5.5</option>
            <option value="chirp-v5">V5</option>
            <option value="chirp-v4-5">V4.5</option>
          </select>
          <span className="mt-2 block text-[10px] leading-4">
            {locale === 'ru' ? 'Suno V6 уже вышел, но текущий API-провайдер пока не публикует V6.' : 'Suno V6 is released, but the current API provider has not published V6 yet.'}
          </span>
        </label>
      )}

      {tool.id === 'elevenlabs-tts' && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">
            {locale === 'ru' ? 'Голос' : 'Voice'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1">
            {(['female', 'male'] as TtsVoice[]).map((voice) => (
              <button
                key={voice}
                type="button"
                onClick={() => {
                  haptics.selection()
                  setTtsVoice(voice)
                }}
                className={'h-10 rounded-xl px-3 text-sm font-semibold transition ' + (ttsVoice === voice ? 'bg-background text-brand shadow-sm' : 'text-muted-foreground')}
              >
                {locale === 'ru' ? TTS_VOICES[voice].ru : TTS_VOICES[voice].en}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            {locale === 'ru'
              ? 'Введите текст ниже и выберите мужской или женский голос.'
              : 'Enter the text below and choose a male or female voice.'}
          </p>
        </div>
      )}

      <label className="mt-5 block text-xs font-medium text-muted-foreground">
        {tool.id === 'elevenlabs-tts'
          ? (locale === 'ru' ? 'Текст для озвучки' : 'Text to speak')
          : isText
            ? (locale === 'ru' ? 'Задача / текст' : 'Task / text')
            : isAudio
              ? (locale === 'ru' ? 'Описание / текст' : 'Description / text')
              : (locale === 'ru' ? 'Промпт' : 'Prompt')}
      </label>
      <textarea
        rows={5}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={tool.id === 'elevenlabs-tts'
          ? (locale === 'ru' ? 'Напишите текст, который хотите озвучить…' : 'Enter the text you want to turn into speech…')
          : (locale === 'ru' ? 'Опишите, что нужно создать…' : 'Describe what you want to create…')}
        className="mt-2 w-full resize-none rounded-2xl border bg-card p-4 text-sm"
      />

      {wantsImageInput && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Референс · необязательно' : 'Reference · optional'}</p>
          <input ref={fileRef} type="file" accept="image/*" onChange={(event) => void chooseFile(event)} className="sr-only" />
          {reference ? (
            <div className="mt-2 flex items-center gap-3 rounded-2xl border bg-card p-3">
              <img src={reference.url} alt="" className="size-16 rounded-xl object-cover" />
              <p className="min-w-0 flex-1 truncate text-xs">{reference.name}</p>
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full border px-3 py-2 text-xs font-semibold">{locale === 'ru' ? 'Заменить' : 'Change'}</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
              <ImagePlus className="size-4" />{locale === 'ru' ? 'Добавить фото' : 'Add image'}
            </button>
          )}
        </div>
      )}

      {wantsVideoInput && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Видео · необязательно (для Video-to-Audio)' : 'Video · optional (for Video-to-Audio)'}</p>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={(event) => void chooseFile(event)} className="sr-only" />
          {reference?.isVideo ? (
            <div className="mt-2 overflow-hidden rounded-2xl border bg-card">
              <video src={reference.url} controls muted playsInline className="max-h-52 w-full bg-black object-contain" />
              <div className="flex items-center justify-between px-3 py-2"><span className="truncate text-xs">{reference.name}</span><button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-brand">{locale === 'ru' ? 'Заменить' : 'Change'}</button></div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/25 bg-brand-tint/30 text-sm font-semibold text-brand">
              <Video className="size-4" />{locale === 'ru' ? 'Добавить видео' : 'Add video'}
            </button>
          )}
        </div>
      )}

      {isVideo && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Длительность' : 'Duration'}</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {durationOptions.map((value) => <option key={value} value={value}>{value} sec</option>)}
            </select>
          </label>
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Формат' : 'Aspect'}</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {videoAspectOptions.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          {tool.id === 'omni-flash' && (
            <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
              <span>{locale === 'ru' ? 'Разрешение' : 'Resolution'}</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
            </label>
          )}
          {tool.id === 'kling-v3' && (
            <>
              <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
                <span>{locale === 'ru' ? 'Разрешение / качество' : 'Resolution / quality'}</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
                  <option value="std">720p · Standard</option>
                  <option value="pro">1080p · Pro</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-2xl border bg-card p-3 text-xs">
                <span>{locale === 'ru' ? 'Со звуком' : 'With audio'}</span>
                <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} className="size-4" />
              </label>
            </>
          )}
        </div>
      )}

      {isImage && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Разрешение' : 'Resolution'}</span>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {['1k','2k','4k'].map((value) => <option key={value}>{value.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
            <span>{locale === 'ru' ? 'Формат' : 'Aspect'}</span>
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
              {['1:1','9:16','16:9','4:3','3:4'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>

        </div>
      )}

      {isText && tool.id !== 'claude-sonnet-5' && (
        <label className="mt-4 block rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>Reasoning</span>
          <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            {['none','low','medium','high'].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      )}

      {isAudio && tool.id === 'kling-audio' && !reference?.isVideo && (
        <label className="mt-4 block rounded-2xl border bg-card p-3 text-xs text-muted-foreground">
          <span>{locale === 'ru' ? 'Длительность SFX' : 'SFX duration'}</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 h-10 w-full rounded-xl border bg-background px-2 text-sm font-semibold text-foreground">
            {[3,4,5,6,7,8,9,10].map((value) => <option key={value}>{value} sec</option>)}
          </select>
        </label>
      )}

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

      <button type="button" onClick={() => void generate()} disabled={generating || prompt.trim().length < 2} className="brand-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white disabled:opacity-45">
        <Sparkles className="size-4" />
        {generating
          ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
          : quotedTokens != null && tokenBalance < quotedTokens
            ? (locale === 'ru' ? `Нужно ${quotedTokens} Tokens` : `Need ${quotedTokens} Tokens`)
            : (locale === 'ru' ? `Создать · ${quotedTokens ?? '…'} Tokens` : `Generate · ${quotedTokens ?? '…'} Tokens`)}
      </button>

      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
      {textResult && (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <p className="whitespace-pre-wrap text-sm leading-6">{textResult}</p>
        </div>
      )}
      {audioDataUrl && (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <audio src={audioDataUrl} controls className="w-full" />
          <button
            type="button"
            onClick={() => void saveTtsAudio()}
            disabled={savingAudio}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-full border text-xs font-semibold transition active:scale-[0.98] disabled:opacity-55"
          >
            {savingAudio
              ? (locale === 'ru' ? 'Подготавливаю…' : 'Preparing…')
              : (locale === 'ru' ? 'Скачать MP3' : 'Download MP3')}
          </button>
          {audioSaveError && <p className="mt-2 text-center text-xs text-destructive">{audioSaveError}</p>}
        </div>
      )}
    </div>
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

async function uploadTrendInputFile(file: File, initData: string) {
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
  const [generateAudio, setGenerateAudio] = useState(trend.generateAudioDefault ?? true)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('480p')
  const [trendTokens, setTrendTokens] = useState(Math.max(0, Number(trend.tokens || 0)))
  const resolutionOptions: Array<'480p' | '720p' | '1080p'> = trend.resolutions?.length
    ? trend.resolutions
    : ['480p', '720p', '1080p']
  const [submitted, setSubmitted] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [resultMessage, setResultMessage] = useState('')
  const title = localize(trend.title, locale)
  const category = localize(getCategory(trend.category).name, locale)
  const canAfford = tokenBalance >= trendTokens
  const ready = trend.inputs.every((input) => !input.required || (typeof values[input.id] === 'string' ? Boolean((values[input.id] as string).trim()) : Boolean(values[input.id])))

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetch(`/api/trends/quote?trendId=${encodeURIComponent(trend.id)}&resolution=${encodeURIComponent(resolution)}`, {
        cache: 'no-store',
      }).then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!cancelled && response.ok && Number.isFinite(Number(data?.tokenCost))) {
          setTrendTokens(Math.max(0, Number(data.tokenCost)))
        }
      }).catch(() => undefined)
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trend.id, resolution])

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
      let response: Response

      if (trend.executionMode === 'direct') {
        const photoInputs = trend.inputs.filter((input) => input.kind === 'photo')
        const referencePaths = await Promise.all(
          photoInputs.map(async (input) => {
            const value = values[input.id]
            if (typeof value !== 'object' || !value?.file) {
              throw new Error(`DIRECT_INPUT_FILE_REQUIRED:${input.id}`)
            }
            return uploadTrendInputFile(value.file, initData)
          }),
        )

        response = await fetch('/api/generate/trend-direct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
          },
          body: JSON.stringify({
            trendId: trend.id,
            referencePaths,
            generateAudio,
            resolution,
          }),
        })
      } else {
        const referencePaths: Record<string, string> = {}
        const referenceUrls: Record<string, string> = {}
        const inputValues: Record<string, string> = {}

        for (const input of trend.inputs) {
          const value = values[input.id]
          if (typeof value === 'string') {
            inputValues[input.id] = value
          } else if (value?.file) {
            referencePaths[input.id] = await uploadTrendInputFile(value.file, initData)
          } else if (value?.url) {
            referenceUrls[input.id] = value.url
          }
        }

        response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
          },
          body: JSON.stringify({
            trendId: trend.id,
            generateAudio,
            resolution,
            referencePaths,
            referenceUrls,
            inputValues,
          }),
        })
      }

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
      } else if (response.status === 413) {
        setResultMessage(locale === 'ru' ? 'Файлы слишком большие для отправки. Попробуйте уменьшить размер фото.' : 'The files are too large to send. Try reducing the image size.')
      } else {
        setResultMessage(locale === 'ru' ? 'Не удалось запустить генерацию. Попробуйте ещё раз.' : 'Could not start generation. Please try again.')
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
        <TokenCost amount={trendTokens} />
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
              onChange={(event) => {
                const next = event.target.value as '480p' | '720p' | '1080p'
                setResolution(resolutionOptions.includes(next) ? next : resolutionOptions[0] || '480p')
              }}
              className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm font-semibold text-foreground"
            >
              {resolutionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === '480p'
                    ? (locale === 'ru' ? 'Стандарт · 480p' : 'Standard · 480p')
                    : option === '720p'
                      ? (locale === 'ru' ? 'Высокое · 720p' : 'High · 720p')
                      : (locale === 'ru' ? 'Максимальное · 1080p' : 'Maximum · 1080p')}
                </option>
              ))}
            </select>
          </label>
          <button
          type="button"
          role="switch"
          aria-checked={generateAudio}
          disabled={trend.generateAudioLocked}
          onClick={() => {
            if (trend.generateAudioLocked) return
            haptics.selection()
            setGenerateAudio((value) => !value)
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition active:scale-[0.99] disabled:cursor-default disabled:opacity-75"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
            <Volume2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{locale === 'ru' ? 'Со звуком' : 'Generate with sound'}</span>
            <span className="block text-xs text-muted-foreground">{
              trend.generateAudioLocked
                ? (locale === 'ru' ? 'Для этого тренда звук отключён.' : 'Audio is disabled for this trend.')
                : trend.sourceAudioMode === 'preserve_source'
                  ? (locale === 'ru' ? 'Сохранить оригинальную музыку и звук тренда.' : 'Keep the trend’s original music and audio.')
                  : (locale === 'ru' ? 'Seedance создаст синхронный звук вместе с видео.' : 'Seedance will create synchronized audio with the video.')
            }</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${generateAudio ? 'bg-brand' : 'bg-muted'}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${generateAudio ? 'left-6' : 'left-1'}`} />
          </span>
          </button>
        </>
      )}

      {trend.id === 'trend4-edit-test' && (
        <div className="mt-4 rounded-2xl border border-brand/15 bg-brand-tint/35 px-4 py-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {locale === 'ru'
              ? '🎵 Музыка не добавляется автоматически. После генерации можно наложить любой трек в любом редакторе.'
              : '🎵 Music is not added automatically. After generation, you can add any track in any editor.'}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={!ready || !canAfford || generating}
        className="brand-gradient mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white shadow-[0_10px_24px_-12px_oklch(0.5_0.21_264/0.8)] transition active:scale-[0.98] disabled:opacity-45 disabled:shadow-none"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {generating
          ? (locale === 'ru' ? 'Запускаю…' : 'Starting…')
          : canAfford
            ? t('trend.generate', { count: trendTokens })
            : (locale === 'ru' ? `Нужно ${trendTokens} Tokens` : `Need ${trendTokens} Tokens`)}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground" aria-live="polite">
        {submitted || generating ? resultMessage : (locale === 'ru' ? 'После запуска задача сразу появится в «Мои работы».' : 'After launch, the job will appear in My works immediately.')}
      </p>
    </div>
  )
}
