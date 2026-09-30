import 'server-only'

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'

function apiKey() {
  const key = process.env.RUNWAYML_API_SECRET
  if (!key) throw new Error('RUNWAY_API_NOT_CONFIGURED')
  return key
}

async function runwayFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${apiKey()}`)
  headers.set('X-Runway-Version', RUNWAY_VERSION)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${RUNWAY_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export type RunwayTask = {
  id: string
  status: string
  output?: string[]
  progress?: number
  failure?: string
  failureCode?: string
  cost?: number
  estimatedCost?: number
}

export async function createSeedance25Task(params: {
  promptText: string
  duration: number
  ratio: string
  references: string[]
  audio?: boolean
}) {
  const response = await runwayFetch('/text_to_video', {
    method: 'POST',
    body: JSON.stringify({
      model: 'seedance2_5',
      promptText: params.promptText,
      duration: params.duration,
      ratio: params.ratio,
      audio: params.audio ?? false,
      references: params.references.map((uri) => ({ uri })),
    }),
  })

  const text = await response.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!response.ok || !data.id) {
    const message = typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : `Runway request failed (${response.status})`
    const error = new Error(message)
    ;(error as Error & { status?: number; details?: unknown }).status = response.status
    ;(error as Error & { status?: number; details?: unknown }).details = data
    throw error
  }

  return data as unknown as RunwayTask
}

export async function getRunwayTask(id: string): Promise<RunwayTask> {
  const response = await runwayFetch(`/tasks/${encodeURIComponent(id)}`)
  const text = await response.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : `Runway task lookup failed (${response.status})`
    throw new Error(message)
  }
  return data as unknown as RunwayTask
}
