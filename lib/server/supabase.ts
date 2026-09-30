import 'server-only'

export function hasDatabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function supabaseFetch(path: string, init: RequestInit = {}) {
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Supabase is not configured')

  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${base.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}
