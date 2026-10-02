'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Search, WalletCards } from 'lucide-react'

type Overview = {
  summary: {
    users: number
    active7d: number
    totalTokens: number
    generations: number
    completed: number
    failed: number
    processing: number
    rubRevenue: number
    referralCommissionRub: number
    pendingPayoutRub: number
  }
  provider: { configured: boolean; balanceUsd: number | null; error?: string | null }
  storage: {
    databaseBytes: number
    generationInputsBytes: number
    trendPreviewsBytes: number
    totalStorageBytes: number
    generationInputsObjects: number
    trendPreviewsObjects: number
    expiredGenerationInputsObjects: number
    expiredGenerationInputsBytes: number
    freePlanStorageQuotaBytes: number
    freePlanDatabaseQuotaBytes: number
    retentionDays: number
  }
  models: Array<{ id: string; category: string; displayName: string; model: string }>
  recent: {
    generations: any[]
    payments: any[]
    ledger: any[]
  }
}

type UserRow = {
  telegram_id: number
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  language_code?: string | null
  token_balance: number
  plan_code?: string | null
  created_at: string
  last_seen_at: string
  referral_code?: string | null
  invited_count: number
  referral_available_rub: number
  referral_pending_rub: number
}

export default function AdminControlCenterPage() {
  const [secret, setSecret] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [amounts, setAmounts] = useState<Record<string,string>>({})
  const [notes, setNotes] = useState<Record<string,string>>({})
  const [busyId, setBusyId] = useState<number | null>(null)
  const [storageBusy, setStorageBusy] = useState(false)

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mrshein.admin.secret')
    if (saved) setSecret(saved)
  }, [])

  const headers = useMemo(() => ({ Authorization: `Bearer ${secret}` }), [secret])

  async function load() {
    setStatus('Загружаю данные…')
    const [overviewResponse, usersResponse] = await Promise.all([
      fetch('/api/admin/overview', { headers, cache: 'no-store' }),
      fetch('/api/admin/users', { headers, cache: 'no-store' }),
    ])
    const [overviewData, usersData] = await Promise.all([
      overviewResponse.json().catch(() => ({})),
      usersResponse.json().catch(() => ({})),
    ])
    if (!overviewResponse.ok || !usersResponse.ok) {
      setAuthorized(false)
      setStatus(overviewData?.error || usersData?.error || 'Ошибка авторизации')
      return
    }
    window.sessionStorage.setItem('mrshein.admin.secret', secret)
    setAuthorized(true)
    setOverview(overviewData)
    setUsers(usersData.users || [])
    setStatus('')
  }

  async function adjustTokens(user: UserRow) {
    const raw = amounts[String(user.telegram_id)] || ''
    const amount = Math.trunc(Number(raw))
    if (!Number.isFinite(amount) || amount === 0) return
    setBusyId(user.telegram_id)
    setStatus('')
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId: user.telegram_id,
        amount,
        note: notes[String(user.telegram_id)] || '',
        requestId: crypto.randomUUID(),
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(data?.error === 'INSUFFICIENT_TOKENS' ? 'Нельзя списать больше токенов, чем есть на балансе.' : data?.error || 'Не удалось изменить баланс.')
      setBusyId(null)
      return
    }
    setStatus(`Баланс обновлён: ${data.tokenBalance} токенов`)
    setAmounts((current) => ({ ...current, [String(user.telegram_id)]: '' }))
    setNotes((current) => ({ ...current, [String(user.telegram_id)]: '' }))
    await load()
    setBusyId(null)
  }

  async function downloadSnapshot() {
    setStatus('Готовлю резервный snapshot…')
    const response = await fetch('/api/admin/export', { headers, cache: 'no-store' })
    if (!response.ok) {
      setStatus('Не удалось создать snapshot.')
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `banana-zero-snapshot-${new Date().toISOString().slice(0,10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus('Snapshot скачан.')
  }


  async function cleanupExpiredMedia() {
    setStorageBusy(true)
    setStatus('Проверяю временные файлы старше 14 дней…')
    const response = await fetch('/api/admin/storage/cleanup', {
      method: 'POST',
      headers,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(data?.error || 'Не удалось очистить временные файлы.')
      setStorageBusy(false)
      return
    }
    setStatus(data.deleted
      ? `Удалено ${data.deleted} временных файлов. Освобождено ${formatBytes(Number(data.freedBytes || 0))}.`
      : 'Файлов старше 14 дней для очистки нет.')
    await load()
    setStorageBusy(false)
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase()
      return name.includes(q)
        || String(user.username || '').toLowerCase().includes(q)
        || String(user.telegram_id).includes(q)
        || String(user.referral_code || '').toLowerCase().includes(q)
    })
  }, [users, search])

  if (!authorized) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
        <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
        <h1 className="mt-3 text-3xl font-black">Control Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">Пользователи, токены, генерации, деньги, рефералы и провайдеры — в одном месте.</p>
        <label className="mt-8 block text-sm font-medium">Admin Secret</label>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-card px-4" />
        <button type="button" disabled={!secret} onClick={() => void load()} className="brand-gradient mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Открыть Control Center</button>
        {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-7 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
          <h1 className="mt-2 text-3xl font-black">Control Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Операционный кабинет владельца платформы.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-full border px-4 py-2 text-xs font-semibold">Контент</Link>
          <Link href="/admin/referrals" className="rounded-full border px-4 py-2 text-xs font-semibold">Рефералы</Link>
          <Link href="/admin/announcements" className="rounded-full border px-4 py-2 text-xs font-semibold">Уведомления</Link>
          <button type="button" onClick={() => void downloadSnapshot()} className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"><Download className="size-4" />Snapshot</button>
          <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"><RefreshCw className="size-4" />Обновить</button>
        </div>
      </header>

      {status && <div className="mt-4 rounded-2xl bg-brand-tint px-4 py-3 text-sm text-brand">{status}</div>}

      {overview && (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {[
              ['Пользователи', overview.summary.users],
              ['Активны 7д', overview.summary.active7d],
              ['Токенов на счетах', overview.summary.totalTokens],
              ['Генерации', overview.summary.generations],
              ['В работе', overview.summary.processing],
              ['Ошибки', overview.summary.failed],
              ['Продажи RUB', `${overview.summary.rubRevenue.toFixed(2)} ₽`],
              ['Реф. выплаты', `${overview.summary.pendingPayoutRub.toFixed(2)} ₽`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-card p-4">
                <p className="text-xl font-black tabular-nums">{value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </section>

          <section className="mt-5 rounded-3xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Хранилище и retention</p>
                <p className="mt-1 text-xs text-muted-foreground">Тяжёлые пользовательские медиа — временные. Финансовые и audit-записи сохраняются отдельно в базе.</p>
              </div>
              <button
                type="button"
                disabled={storageBusy || overview.storage.expiredGenerationInputsObjects === 0}
                onClick={() => void cleanupExpiredMedia()}
                className="rounded-full border px-4 py-2 text-xs font-semibold disabled:opacity-40"
              >
                {storageBusy ? 'Очищаю…' : 'Удалить >14 дней'}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Media Storage', overview.storage.totalStorageBytes, overview.storage.freePlanStorageQuotaBytes],
                ['Generation inputs', overview.storage.generationInputsBytes, overview.storage.freePlanStorageQuotaBytes],
                ['Trend previews', overview.storage.trendPreviewsBytes, overview.storage.freePlanStorageQuotaBytes],
                ['Postgres DB', overview.storage.databaseBytes, overview.storage.freePlanDatabaseQuotaBytes],
              ].map(([label, rawUsed, rawQuota]) => {
                const used = Number(rawUsed)
                const quota = Number(rawQuota)
                const pct = quota > 0 ? Math.min(999, used / quota * 100) : 0
                return (
                  <div key={String(label)} className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-lg font-black">{formatBytes(used)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{String(label)} · {pct.toFixed(0)}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${pct >= 85 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Входных файлов: <strong className="text-foreground">{overview.storage.generationInputsObjects}</strong></span>
              <span>На очистку сейчас: <strong className="text-foreground">{overview.storage.expiredGenerationInputsObjects}</strong></span>
              <span>Retention: <strong className="text-foreground">{overview.storage.retentionDays} дней</strong></span>
            </div>
            {overview.storage.totalStorageBytes / overview.storage.freePlanStorageQuotaBytes >= 0.7 && (
              <div className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-800">
                Хранилище заполнено более чем на 70%. До массового запуска нужно переключить тяжёлые пользовательские медиа на масштабируемое object storage.
              </div>
            )}
          </section>

          <section className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-banana/15 text-amber-700"><WalletCards className="size-5" /></span>
                <div>
                  <p className="text-sm font-semibold">APIMODELS</p>
                  <p className="text-xs text-muted-foreground">Реальный баланс провайдера</p>
                </div>
              </div>
              <p className="mt-5 text-3xl font-black tabular-nums">{overview.provider.balanceUsd == null ? '—' : `$${overview.provider.balanceUsd.toFixed(4)}`}</p>
              {overview.provider.error && <p className="mt-2 text-xs text-red-600">{overview.provider.error}</p>}
            </div>

            <div className="rounded-3xl border bg-card p-5">
              <p className="text-sm font-semibold">Подключённый стек</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {overview.models.map((model) => (
                  <span key={model.id} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">{model.displayName}</span>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Пользователи и creators</h2>
            <p className="mt-1 text-xs text-muted-foreground">Ищи по имени, @username, Telegram ID или реферальному коду. Начисление и списание всегда записываются в ledger и audit log.</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border bg-card px-4">
          <Search className="size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск пользователя или реферального кода" className="h-12 flex-1 bg-transparent text-sm outline-none" />
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Реф. код</th>
                  <th className="px-4 py-3">Приглашено</th>
                  <th className="px-4 py-3">Реф. баланс</th>
                  <th className="px-4 py-3">Токены</th>
                  <th className="px-4 py-3">Изменить токены</th>
                  <th className="px-4 py-3">Последняя активность</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => {
                  const key = String(user.telegram_id)
                  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `ID ${user.telegram_id}`
                  return (
                    <tr key={user.telegram_id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${user.telegram_id}`} className="font-semibold text-brand hover:underline">{name}</Link>
                        <p className="text-xs text-muted-foreground">{user.username ? `@${user.username} · ` : ''}{user.telegram_id}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{user.referral_code || '—'}</td>
                      <td className="px-4 py-3">{user.invited_count || 0}</td>
                      <td className="px-4 py-3 text-xs">{user.referral_available_rub.toFixed(2)} ₽ <span className="text-muted-foreground">+ {user.referral_pending_rub.toFixed(2)} ₽ pending</span></td>
                      <td className="px-4 py-3 text-lg font-black tabular-nums">{user.token_balance}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input value={amounts[key] || ''} onChange={(e) => setAmounts((current) => ({ ...current, [key]: e.target.value }))} inputMode="numeric" placeholder="+2000 / -100" className="h-9 w-28 rounded-xl border bg-background px-2 text-xs" />
                          <input value={notes[key] || ''} onChange={(e) => setNotes((current) => ({ ...current, [key]: e.target.value }))} placeholder="Причина" className="h-9 w-40 rounded-xl border bg-background px-2 text-xs" />
                          <button type="button" disabled={busyId === user.telegram_id || !Number(amounts[key])} onClick={() => void adjustTokens(user)} className="h-9 rounded-full bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-40">Применить</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(user.last_seen_at).toLocaleString('ru-RU')}</td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Ничего не найдено</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {overview && (
        <section className="mt-7 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border bg-card p-5">
            <h2 className="font-bold">Последние генерации</h2>
            <div className="mt-3 space-y-2">
              {overview.recent.generations.slice(0, 10).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-xs">
                  <div className="min-w-0"><p className="truncate font-semibold">{item.title}</p><p className="truncate text-muted-foreground">{item.model || item.provider || '—'}</p></div>
                  <span className="shrink-0">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-card p-5">
            <h2 className="font-bold">Последние операции токенов</h2>
            <div className="mt-3 space-y-2">
              {overview.recent.ledger.slice(0, 10).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-xs">
                  <div className="min-w-0"><p className="truncate font-semibold">{item.reference || item.event_type}</p><p className="text-muted-foreground">Telegram {item.telegram_id}</p></div>
                  <span className={`shrink-0 font-black ${Number(item.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Number(item.amount) >= 0 ? '+' : ''}{item.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
