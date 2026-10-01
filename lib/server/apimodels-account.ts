import 'server-only'

const ACCOUNT_BASE = 'https://api.apimodels.app/v1'

function key() {
  const value = process.env.APIMODELS_API_KEY
  if (!value) throw new Error('APIMODELS_API_NOT_CONFIGURED')
  return value
}

export async function getApiModelsBalance() {
  const response = await fetch(`${ACCOUNT_BASE}/balance`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: any = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!response.ok) throw new Error(String(payload?.message || payload?.error || `APIMODELS_BALANCE_FAILED_${response.status}`))
  const data = payload?.data ?? payload
  const value = Number(data?.balance ?? data?.credits ?? data?.available_balance ?? data?.available ?? 0)
  return {
    balanceUsd: Number.isFinite(value) ? value : 0,
    raw: data,
  }
}

export async function getApiModelsRecord(taskId: string) {
  const response = await fetch(`https://api.apimodels.app/v1/records/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: any = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { raw: text } }
  if (!response.ok) throw new Error(String(payload?.message || payload?.error || `APIMODELS_RECORD_FAILED_${response.status}`))
  const data = payload?.data ?? payload
  return {
    taskId: String(data?.task_id || taskId),
    model: String(data?.model || ''),
    state: String(data?.state || ''),
    settled: Boolean(data?.settled),
    creditsUsd: data?.credits == null ? null : Number(data.credits),
    currency: String(data?.currency || 'USD'),
    usage: data?.usage || null,
  }
}
