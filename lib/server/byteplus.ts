import 'server-only'

const BYTEPLUS_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3'
const BYTEPLUS_MODEL = 'dreamina-seedance-2-5-260628'

export type BytePlusResolution = '480p' | '720p' | '1080p'

function apiKey() {
  const key = process.env.ARK_API_KEY
  if (!key) throw new Error('BYTEPLUS_API_NOT_CONFIGURED')
  return key
}

async function bytePlusFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey()}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${BYTEPLUS_BASE}${path}`, { ...init, headers, cache: 'no-store' })
}

export type BytePlusTask = {
  id: string
  status: string
  content?: { video_url?: string }
  error?: { code?: string; message?: string }
  usage?: { completion_tokens?: number; total_tokens?: number }
  resolution?: string
  ratio?: string
  duration?: number
}

async function createTask(body: Record<string, unknown>) {
  const response = await bytePlusFetch('/contents/generations/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!response.ok || !data.id) {
    const errObj = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : null
    const message = typeof errObj?.message === 'string'
      ? errObj.message
      : typeof data.message === 'string'
        ? data.message
        : `BytePlus request failed (${response.status})`
    const error = new Error(message)
    ;(error as Error & { status?: number; details?: unknown }).status = response.status
    ;(error as Error & { status?: number; details?: unknown }).details = data
    throw error
  }

  return data as unknown as BytePlusTask
}

export async function createBytePlusSeedance25Task(params: {
  promptText: string
  duration: number
  ratio: string
  references: string[]
  videoReferences?: string[]
  resolution?: BytePlusResolution
  generateAudio?: boolean
}) {
  const content = [
    { type: 'text', text: params.promptText },
    ...(params.videoReferences || []).map((url) => ({
      type: 'video_url',
      video_url: { url },
      role: 'reference_video',
    })),
    ...params.references.map((url) => ({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
    })),
  ]

  return createTask({
    model: BYTEPLUS_MODEL,
    content,
    generate_audio: params.generateAudio !== false,
    resolution: params.resolution || '480p',
    ratio: params.ratio,
    duration: params.duration,
    omni_reference_task_type: 'reference',
    watermark: false,
    output_format: 'mp4',
  })
}

export async function createBytePlusSeedance25EditTask(params: {
  promptText: string
  videoUrl: string
  references: string[]
  resolution?: BytePlusResolution
  generateAudio?: boolean
}) {
  const content = [
    { type: 'text', text: params.promptText },
    {
      type: 'video_url',
      video_url: { url: params.videoUrl },
      role: 'reference_video',
    },
    ...params.references.map((url) => ({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
    })),
  ]

  return createTask({
    model: BYTEPLUS_MODEL,
    content,
    generate_audio: params.generateAudio !== false,
    resolution: params.resolution || '480p',
    ratio: 'adaptive',
    duration: -1,
    omni_reference_task_type: 'edit',
    watermark: false,
    output_format: 'mp4',
  })
}

export async function getBytePlusTask(id: string): Promise<BytePlusTask> {
  const response = await bytePlusFetch(`/contents/generations/tasks/${encodeURIComponent(id)}`)
  const text = await response.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!response.ok) {
    const errObj = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : null
    const message = typeof errObj?.message === 'string'
      ? errObj.message
      : typeof data.message === 'string'
        ? data.message
        : `BytePlus task lookup failed (${response.status})`
    throw new Error(message)
  }
  return data as unknown as BytePlusTask
}
