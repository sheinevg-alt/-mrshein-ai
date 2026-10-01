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
    const message = task.error || task.failureCode || `APIMODELS request failed (${response.status})`
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
    throw new Error(task.error || task.failureCode || `APIMODELS task lookup failed (${response.status})`)
  }

  return parseTaskPayload(payload)
}
