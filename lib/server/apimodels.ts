import 'server-only'

const APIMODELS_BASE = 'https://api.apimodels.app/v1'
const APIMODELS_MODEL = 'seedance-2.5'

export type ApiModelsResolution = '480p' | '720p'

function apiKey() {
  const key = process.env.APIMODELS_API_KEY
  if (!key) throw new Error('APIMODELS_API_NOT_CONFIGURED')
  return key
}

async function apiModelsFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey()}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${APIMODELS_BASE}${path}`, { ...init, headers, cache: 'no-store' })
}


const PEOPLE_GROUP_NAME = 'shein-ai-people'

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function extractGroupList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item) => objectRecord(item)) as Record<string, unknown>[]
  const root = objectRecord(payload)
  if (!root) return []
  const data = root.data
  if (Array.isArray(data)) return data.filter((item) => objectRecord(item)) as Record<string, unknown>[]
  const dataRecord = objectRecord(data)
  for (const key of ['items', 'groups', 'data']) {
    const value = dataRecord?.[key] ?? root[key]
    if (Array.isArray(value)) return value.filter((item) => objectRecord(item)) as Record<string, unknown>[]
  }
  return []
}

async function ensurePeopleGroupId(): Promise<string | number> {
  const listResponse = await apiModelsFetch('/assets/groups')
  const listText = await listResponse.text()
  let listPayload: unknown = {}
  try { listPayload = listText ? JSON.parse(listText) : {} } catch { listPayload = {} }

  if (listResponse.ok) {
    const existing = extractGroupList(listPayload).find((group) => {
      const name = String(group.name || group.group_name || group.title || '')
      return name === PEOPLE_GROUP_NAME
    })
    const existingId = existing?.id ?? existing?.group_id
    if (typeof existingId === 'string' || typeof existingId === 'number') return existingId
  }

  const createResponse = await apiModelsFetch('/assets/groups', {
    method: 'POST',
    body: JSON.stringify({ name: PEOPLE_GROUP_NAME }),
  })
  const createText = await createResponse.text()
  let createPayload: Record<string, unknown> = {}
  try { createPayload = createText ? JSON.parse(createText) : {} } catch { createPayload = { raw: createText } }

  const data = objectRecord(createPayload.data) || createPayload
  const groupId = data.id ?? data.group_id
  if (!createResponse.ok || (typeof groupId !== 'string' && typeof groupId !== 'number')) {
    throw new Error(`APIMODELS_ASSET_GROUP_FAILED_${createResponse.status}`)
  }
  return groupId
}

export async function registerApiModelsPortrait(imageUrl: string, name?: string) {
  const groupId = await ensurePeopleGroupId()
  const response = await apiModelsFetch('/assets', {
    method: 'POST',
    body: JSON.stringify({
      url: imageUrl,
      asset_type: 'Image',
      group_id: groupId,
      ...(name ? { name } : {}),
    }),
  })

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }

  const data = objectRecord(payload.data) || payload
  const assetUrl = String(data.asset_url || data.assetUrl || '')
  const status = String(data.status || '').toLowerCase()
  if (!response.ok || !assetUrl.startsWith('asset://') || (status && status !== 'active')) {
    const message = firstString(
      data.message,
      data.error,
      payload.message,
      payload.error,
    ) || `APIMODELS_PORTRAIT_REGISTER_FAILED_${response.status}`
    throw new Error(message)
  }

  return {
    assetUrl,
    id: String(data.id || ''),
    status: String(data.status || 'Active'),
    groupId,
  }
}

export type ApiModelsTask = {
  id?: string
  state: string
  resultUrls: string[]
  error?: string
  failureCode?: string
  retryable?: boolean
  usage?: unknown
  creditsUsd?: number | null
  raw?: unknown
}

function extractError(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['failMsg', 'fail_msg', 'failureMessage', 'failure_message', 'message', 'error', 'detail', 'details', 'code']) {
      if (typeof record[key] === 'string' && record[key]) return String(record[key])
    }
  }
  return String(value)
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function parseRetryable(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes'].includes(normalized)) return true
    if (['false', '0', 'no'].includes(normalized)) return false
  }
  return undefined
}

function parseTaskPayload(payload: Record<string, unknown>): ApiModelsTask {
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload

  const output = data.output && typeof data.output === 'object'
    ? data.output as Record<string, unknown>
    : null

  let resultJson: Record<string, unknown> | null = null
  const rawResultJson = data.resultJson ?? data.result_json
  if (typeof rawResultJson === 'string' && rawResultJson.trim()) {
    try {
      const parsed = JSON.parse(rawResultJson)
      resultJson = objectRecord(parsed)
    } catch {
      resultJson = null
    }
  } else {
    resultJson = objectRecord(rawResultJson)
  }

  const resultUrls = [
    ...(Array.isArray(data.resultUrls) ? data.resultUrls : []),
    ...(Array.isArray(data.result_urls) ? data.result_urls : []),
    ...(Array.isArray(output?.video_urls) ? output.video_urls as unknown[] : []),
    ...(Array.isArray(output?.image_urls) ? output.image_urls as unknown[] : []),
    ...(Array.isArray(output?.audio_urls) ? output.audio_urls as unknown[] : []),
    ...(Array.isArray(output?.urls) ? output.urls as unknown[] : []),
    ...(Array.isArray(data.images) ? data.images as unknown[] : []),
    ...(Array.isArray(data.audios) ? data.audios as unknown[] : []),
    ...(typeof output?.video_url === 'string' ? [output.video_url] : []),
    ...(typeof output?.image_url === 'string' ? [output.image_url] : []),
    ...(typeof output?.audio_url === 'string' ? [output.audio_url] : []),
    ...(typeof output?.url === 'string' ? [output.url] : []),
    ...(typeof data.video_url === 'string' ? [data.video_url] : []),
    ...(typeof data.image_url === 'string' ? [data.image_url] : []),
    ...(typeof data.audio_url === 'string' ? [data.audio_url] : []),
    ...(Array.isArray(resultJson?.resultUrls) ? resultJson!.resultUrls as unknown[] : []),
    ...(Array.isArray(resultJson?.result_urls) ? resultJson!.result_urls as unknown[] : []),
    ...(typeof resultJson?.video_url === 'string' ? [resultJson.video_url] : []),
  ].map((value) => String(value || '')).filter(Boolean)

  const state = String(data.state || data.status || payload.status || '').toLowerCase()
  const id = String(data.taskId || data.task_id || data.id || payload.id || '') || undefined
  const failureCode = firstString(
    data.failCode,
    data.fail_code,
    data.failureCode,
    data.failure_code,
    payload.failCode,
    payload.fail_code,
    payload.failureCode,
    payload.failure_code,
  ) || undefined
  const error = extractError(
    data.failMsg ||
    data.fail_msg ||
    data.failureMessage ||
    data.failure_message ||
    data.error ||
    payload.failMsg ||
    payload.fail_msg ||
    payload.failureMessage ||
    payload.failure_message ||
    payload.error ||
    data.message ||
    payload.message,
  ) || failureCode
  const retryable = parseRetryable(data.retryable ?? payload.retryable)

  return {
    id,
    state,
    resultUrls,
    error: error || undefined,
    failureCode,
    retryable,
    usage: data.usage || payload.usage || null,
    creditsUsd: data.credits == null ? null : Number(data.credits),
    raw: payload,
  }
}

async function createTaskAt(path: string, body: Record<string, unknown>) {
  const response = await apiModelsFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }

  const task = parseTaskPayload(payload)
  if (!response.ok || !task.id) {
    const message = task.error || task.failureCode || `APIMODELS request failed (${response.status})`
    const error = new Error(message)
    ;(error as Error & { status?: number; details?: unknown }).status = response.status
    ;(error as Error & { status?: number; details?: unknown }).details = payload
    throw error
  }

  return task
}

async function createTask(body: Record<string, unknown>) {
  return createTaskAt('/video/generations', body)
}

export async function createApiModelsSeedance25Task(params: {
  promptText: string
  duration: number
  ratio: string
  references: string[]
  videoReferences?: string[]
  resolution?: ApiModelsResolution
  generateAudio?: boolean
  callbackUrl?: string
}) {
  return createTask({
    model: APIMODELS_MODEL,
    prompt: params.promptText,
    resolution: params.resolution || '480p',
    aspect_ratio: params.ratio,
    duration: params.duration,
    generate_audio: params.generateAudio !== false,
    output_format: 'mp4',
    task_type: 'generate',
    reference_image_urls: params.references,
    reference_video_urls: params.videoReferences || [],
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  })
}

export async function createApiModelsSeedance25EditTask(params: {
  promptText: string
  videoUrl: string
  references: string[]
  resolution?: ApiModelsResolution
  generateAudio?: boolean
  callbackUrl?: string
}) {
  return createTask({
    model: APIMODELS_MODEL,
    prompt: params.promptText,
    resolution: params.resolution || '480p',
    generate_audio: params.generateAudio !== false,
    output_format: 'mp4',
    task_type: 'edit',
    reference_image_urls: params.references,
    reference_video_urls: [params.videoUrl],
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  })
}

export type ApiModelsTaskKind = 'video' | 'image' | 'audio'

export async function getApiModelsGenerationTask(id: string, kind: ApiModelsTaskKind = 'video'): Promise<ApiModelsTask> {
  const endpoint = kind === 'image' ? '/images/generations' : kind === 'audio' ? '/audio/generations' : '/video/generations'
  const response = await apiModelsFetch(`${endpoint}?task_id=${encodeURIComponent(id)}`)
  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }

  if (!response.ok) {
    const task = parseTaskPayload(payload)
    throw new Error(task.error || task.failureCode || `APIMODELS task lookup failed (${response.status})`)
  }

  return parseTaskPayload(payload)
}

export async function getApiModelsTask(id: string): Promise<ApiModelsTask> {
  return getApiModelsGenerationTask(id, 'video')
}


export type ApiModelsOmniResolution = '720p' | '1080p' | '4k'
export type ApiModelsKlingModel = 'kling-v2-6' | 'kling-v3'
export type ApiModelsKlingMode = 'std' | 'pro'

export async function createApiModelsGeminiOmniFlashTask(params: {
  promptText: string
  duration: 4 | 6 | 8 | 10
  ratio: '16:9' | '9:16'
  resolution?: ApiModelsOmniResolution
  firstFrameUrl?: string
  lastFrameUrl?: string
  references?: string[]
  callbackUrl?: string
}) {
  const references = (params.references || []).filter(Boolean).slice(0, 7)
  if (params.lastFrameUrl && !params.firstFrameUrl) {
    throw new Error('OMNI_LAST_FRAME_REQUIRES_FIRST_FRAME')
  }
  if ((params.firstFrameUrl || params.lastFrameUrl) && references.length > 0) {
    throw new Error('OMNI_KEYFRAMES_CANNOT_COMBINE_WITH_REFERENCES')
  }

  return createTask({
    model: 'gemini-omni-1.1-flash',
    prompt: params.promptText,
    duration: String(params.duration),
    resolution: params.resolution || '720p',
    aspect_ratio: params.ratio,
    ...(params.firstFrameUrl ? { first_frame_url: params.firstFrameUrl } : {}),
    ...(params.lastFrameUrl ? { last_frame_url: params.lastFrameUrl } : {}),
    ...(references.length ? { images: references } : {}),
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  })
}

export async function createApiModelsKlingTask(params: {
  model?: ApiModelsKlingModel
  promptText: string
  duration: number
  ratio: string
  imageUrl?: string
  mode?: ApiModelsKlingMode
  generateAudio?: boolean
  negativePrompt?: string
  callbackUrl?: string
}) {
  const model = params.model || 'kling-v3'
  const duration = model === 'kling-v2-6'
    ? (params.duration >= 10 ? 10 : 5)
    : Math.max(3, Math.min(15, Math.round(params.duration)))

  return createTask({
    model,
    prompt: params.promptText,
    mode: params.mode || 'std',
    duration: String(duration),
    sound: params.generateAudio ? 'on' : 'off',
    aspect_ratio: params.ratio,
    ...(params.imageUrl ? { image: params.imageUrl } : {}),
    ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  })
}


export type ApiModelsImageResolution = '1k' | '2k' | '4k'

export async function createApiModelsImageTask(params: {
  model: 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image' | 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst'
  promptText: string
  ratio?: string
  resolution?: ApiModelsImageResolution
  references?: string[]
  callbackUrl?: string
}) {
  const references = (params.references || []).filter(Boolean).slice(0, 10)
  return createTaskAt('/images/generations', {
    model: params.model,
    prompt: params.promptText,
    aspect_ratio: params.ratio || '1:1',
    resolution: params.resolution || '2k',
    ...(references.length ? { images: references } : {}),
    ...(params.callbackUrl ? { callback_url: params.callbackUrl } : {}),
  })
}

export async function createApiModelsAudioTask(params: {
  model: 'suno-v5' | 'kling-sound-effects' | 'kling-video-to-audio'
  promptText: string
  duration?: number
  videoUrl?: string
  bgmPrompt?: string
  callbackUrl?: string
}) {
  const body: Record<string, unknown> = { model: params.model }
  if (params.model === 'suno-v5') {
    body.description = params.promptText
    body.mv = 'chirp-v5'
  } else if (params.model === 'kling-video-to-audio') {
    if (!params.videoUrl) throw new Error('VIDEO_REQUIRED')
    body.video_url = params.videoUrl
    body.sound_effect_prompt = params.promptText
    body.bgm_prompt = params.bgmPrompt || ''
    body.asmr_mode = false
  } else {
    body.prompt = params.promptText
    if (params.model === 'kling-sound-effects') {
      body.duration = String(Math.max(3, Math.min(10, Number(params.duration || 5))).toFixed(1))
    }
  }
  if (params.callbackUrl) body.callback_url = params.callbackUrl
  return createTaskAt('/audio/generations', body)
}

export async function createApiModelsChatCompletion(params: {
  model: 'gpt-6-sol' | 'gpt-6-luna' | 'claude-sonnet-5'
  promptText: string
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high'
}) {
  const isClaude = params.model === 'claude-sonnet-5'
  const path = isClaude ? '/messages' : '/chat/completions'
  const body = isClaude
    ? {
        model: params.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: params.promptText }],
      }
    : {
        model: params.model,
        messages: [{ role: 'user', content: params.promptText }],
        stream: false,
        reasoning_effort: params.reasoningEffort || 'medium',
      }

  const response = await apiModelsFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let payload: any = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!response.ok) throw new Error(String(payload?.error?.message || payload?.message || `APIMODELS_CHAT_FAILED_${response.status}`))

  const content = isClaude
    ? String(payload?.content?.find?.((item: any) => item?.type === 'text')?.text || '')
    : String(payload?.choices?.[0]?.message?.content || '')
  const requestId = String(response.headers.get('x-apimodels-request-id') || payload?.apimodels?.request_id || payload?.id || '')
  const costHeader = response.headers.get('x-apimodels-cost')
  const cost = costHeader != null ? Number(costHeader) : payload?.apimodels?.cost == null ? null : Number(payload.apimodels.cost)
  return {
    text: content,
    requestId,
    creditsUsd: Number.isFinite(cost as number) ? cost : null,
    usage: payload?.usage || null,
  }
}


export async function createApiModelsElevenTts(params: {
  text: string
  voiceId?: string
  model?: 'eleven-tts-flash' | 'eleven-tts-turbo' | 'eleven-tts-multilingual' | 'eleven-tts-v3'
}) {
  const response = await apiModelsFetch('/tts/stream', {
    method: 'POST',
    body: JSON.stringify({
      model: params.model || 'eleven-tts-v3',
      text: params.text,
      voice_id: params.voiceId || 'EXAVITQu4vr4xnSDxMaL',
    }),
  })
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `APIMODELS_TTS_FAILED_${response.status}`)
  }
  const audio = Buffer.from(await response.arrayBuffer())
  const requestId = String(response.headers.get('x-apimodels-request-id') || '')
  const costHeader = response.headers.get('x-apimodels-cost')
  const cost = costHeader == null ? null : Number(costHeader)
  return {
    audio,
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    requestId,
    creditsUsd: Number.isFinite(cost as number) ? cost : null,
  }
}
