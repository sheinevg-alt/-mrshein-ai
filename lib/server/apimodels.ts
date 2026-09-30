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

export type ApiModelsTask = {
  id?: string
  state: string
  resultUrls: string[]
  error?: string
  usage?: unknown
  raw?: unknown
}

function extractError(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'detail', 'details', 'code']) {
      if (typeof record[key] === 'string' && record[key]) return String(record[key])
    }
  }
  return String(value)
}

function parseTaskPayload(payload: Record<string, unknown>): ApiModelsTask {
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload

  const output = data.output && typeof data.output === 'object'
    ? data.output as Record<string, unknown>
    : null

  const resultUrls = [
    ...(Array.isArray(data.resultUrls) ? data.resultUrls : []),
    ...(Array.isArray(data.result_urls) ? data.result_urls : []),
    ...(Array.isArray(output?.video_urls) ? output.video_urls as unknown[] : []),
    ...(Array.isArray(output?.urls) ? output.urls as unknown[] : []),
    ...(typeof output?.video_url === 'string' ? [output.video_url] : []),
    ...(typeof data.video_url === 'string' ? [data.video_url] : []),
  ].map((value) => String(value || '')).filter(Boolean)

  const state = String(data.state || data.status || payload.status || '').toLowerCase()
  const id = String(data.taskId || data.task_id || data.id || payload.id || '') || undefined
  const error = extractError(data.error || payload.error || data.message || payload.message)

  return {
    id,
    state,
    resultUrls,
    error: error || undefined,
    usage: data.usage || payload.usage || null,
    raw: payload,
  }
}

async function createTask(body: Record<string, unknown>) {
  const response = await apiModelsFetch('/video/generations', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }

  const task = parseTaskPayload(payload)
  if (!response.ok || !task.id) {
    const message = task.error || `APIMODELS request failed (${response.status})`
    const error = new Error(message)
    ;(error as Error & { status?: number; details?: unknown }).status = response.status
    ;(error as Error & { status?: number; details?: unknown }).details = payload
    throw error
  }

  return task
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

export async function getApiModelsTask(id: string): Promise<ApiModelsTask> {
  const response = await apiModelsFetch(`/video/generations?task_id=${encodeURIComponent(id)}`)
  const text = await response.text()
  let payload: Record<string, unknown> = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }

  if (!response.ok) {
    const task = parseTaskPayload(payload)
    throw new Error(task.error || `APIMODELS task lookup failed (${response.status})`)
  }

  return parseTaskPayload(payload)
}
