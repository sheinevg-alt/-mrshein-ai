import 'server-only'
import https from 'node:https'

const ROOT_CA_URL = 'https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt'
const SUB_CA_URL = 'https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt'

let caPromise: Promise<string[]> | null = null

async function loadRussianTrustedCa() {
  if (!caPromise) {
    caPromise = Promise.all([ROOT_CA_URL, SUB_CA_URL].map(async (url) => {
      const response = await fetch(url, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`TOCHKA_CA_DOWNLOAD_FAILED_${response.status}`)
      const pem = await response.text()
      if (!pem.includes('-----BEGIN CERTIFICATE-----')) throw new Error('TOCHKA_CA_INVALID_PEM')
      return pem
    }))
  }
  return caPromise
}

export async function tochkaRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  const ca = await loadRussianTrustedCa()

  return new Promise<{
    ok: boolean
    status: number
    text: string
    json: any
    headers: Record<string, string | string[] | undefined>
  }>((resolve, reject) => {
    const request = https.request({
      protocol: 'https:',
      hostname: 'enter.tochka.com',
      port: 443,
      path,
      method: init.method || 'GET',
      servername: 'enter.tochka.com',
      ca,
      rejectUnauthorized: true,
      headers: init.headers,
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json: any = null
        try { json = text ? JSON.parse(text) : null } catch { json = null }
        const status = response.statusCode || 0
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text,
          json,
          headers: response.headers,
        })
      })
    })

    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })
}

export function tochkaAuthHeaders(token: string, jsonBody = false) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
  }
}
