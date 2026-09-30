import 'server-only'

function config() {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Supabase is not configured')
  return { base: base.replace(/\/$/, ''), key }
}

export function hasDatabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function supabaseFetch(path: string, init: RequestInit = {}) {
  const { base, key } = config()
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

async function storageFetch(path: string, init: RequestInit = {}) {
  const { base, key } = config()
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${base}/storage/v1/${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export async function createStorageSignedUploadUrl(bucket: string, path: string) {
  const response = await storageFetch(`object/upload/sign/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!response.ok) throw new Error(String(data?.message || data?.error || `STORAGE_SIGN_UPLOAD_FAILED_${response.status}`))

  const { base } = config()
  const rawUrl = String(data?.url || data?.signedURL || data?.signedUrl || '')
  if (!rawUrl) throw new Error('STORAGE_SIGN_UPLOAD_URL_MISSING')
  const signedUrl = rawUrl.startsWith('http') ? rawUrl : `${base}/storage/v1${rawUrl}`
  return { signedUrl, path }
}

export async function createStorageSignedDownloadUrl(bucket: string, path: string, expiresIn = 7200) {
  const response = await storageFetch(`object/sign/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  })
  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!response.ok) throw new Error(String(data?.message || data?.error || `STORAGE_SIGN_DOWNLOAD_FAILED_${response.status}`))

  const { base } = config()
  const rawUrl = String(data?.signedURL || data?.signedUrl || data?.url || '')
  if (!rawUrl) throw new Error('STORAGE_SIGN_DOWNLOAD_URL_MISSING')
  return rawUrl.startsWith('http') ? rawUrl : `${base}/storage/v1${rawUrl}`
}
