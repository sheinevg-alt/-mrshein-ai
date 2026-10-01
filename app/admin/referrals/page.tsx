'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Summary = {
  partners: number
  referredUsers: number
  totalSalesRub: number
  totalCommissionRub: number
  availableRub: number
  pendingRub: number
}

type PayoutRow = {
  id: string
  telegram_id: number
  payout_method: 'card' | 'crypto'
  amount_rub: number
  status: string
  requested_at: string
  processed_at?: string | null
  admin_note?: string | null
}

type ReferralRow = {
  telegramId: number
  referralCode: string
  name: string
  username?: string | null
  tokenBalance: number
  invitedCount: number
  salesRub: number
  earnedRub: number
  availableRub: number
  pendingRub: number
  referredBy?: number | null
  createdAt: string
  lastSeenAt?: string | null
}

export default function ReferralAdminPage() {
  const [secret, setSecret] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mrshein.admin.secret')
    if (saved) setSecret(saved)
  }, [])

  async function load() {
    setStatus('Загрузка…')
    const response = await fetch('/api/admin/referrals', {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setAuthorized(false)
      setStatus(data?.error || 'Ошибка')
      return
    }
    window.sessionStorage.setItem('mrshein.admin.secret', secret)
    setAuthorized(true)
    setSummary(data.summary || null)
    setRows(data.referrals || [])
    setPayouts(data.payouts || [])
    setStatus('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      row.name.toLowerCase().includes(q) ||
      String(row.username || '').toLowerCase().includes(q) ||
      row.referralCode.toLowerCase().includes(q) ||
      String(row.telegramId).includes(q),
    )
  }, [rows, search])

  async function updatePayout(requestId: string, nextStatus: 'approved' | 'paid' | 'rejected') {
    setStatus('Обновляю заявку…')
    const response = await fetch('/api/admin/referrals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId, status: nextStatus }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(data?.error || 'Ошибка обновления выплаты')
      return
    }
    await load()
  }

  if (!authorized) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
        <p className="text-xs font-bold tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
        <h1 className="mt-3 text-3xl font-black">Реферальная программа</h1>
        <p className="mt-2 text-sm text-muted-foreground">Участники, приглашения, продажи и начисления.</p>
        <label className="mt-8 block text-sm font-medium">Admin Secret</label>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-card px-4" />
        <button type="button" disabled={!secret} onClick={() => void load()} className="brand-gradient mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Открыть кабинет</button>
        {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
          <h1 className="mt-2 text-3xl font-black">Рефералы</h1>
          <p className="mt-1 text-sm text-muted-foreground">Источник истины — PostgreSQL ledger. Начисления не считаются на клиенте.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-medium">Основная админка</Link>
          <button type="button" onClick={() => void load()} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">Обновить</button>
        </div>
      </div>

      {summary && (
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            ['Партнёров', summary.partners],
            ['Приглашено', summary.referredUsers],
            ['Продажи', `${summary.totalSalesRub.toFixed(2)} ₽`],
            ['Комиссия', `${summary.totalCommissionRub.toFixed(2)} ₽`],
            ['Доступно', `${summary.availableRub.toFixed(2)} ₽`],
            ['Ожидает', `${summary.pendingRub.toFixed(2)} ₽`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-card p-4">
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>
      )}

      {payouts.length > 0 && (
        <section className="mt-6 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Заявки на вывод</h2>
            <span className="text-xs text-muted-foreground">Проверяются вручную</span>
          </div>
          <div className="mt-3 space-y-2">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Telegram {payout.telegram_id} · {payout.payout_method === 'card' ? 'Карта' : 'Крипта'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{Number(payout.amount_rub).toFixed(2)} ₽ · {payout.status} · {new Date(payout.requested_at).toLocaleString('ru-RU')}</p>
                </div>
                {payout.status === 'pending' && (
                  <>
                    <button type="button" onClick={() => void updatePayout(payout.id, 'approved')} className="rounded-full border px-3 py-2 text-xs font-medium">Одобрить</button>
                    <button type="button" onClick={() => void updatePayout(payout.id, 'rejected')} className="rounded-full border px-3 py-2 text-xs font-medium">Отклонить</button>
                  </>
                )}
                {payout.status === 'approved' && (
                  <button type="button" onClick={() => void updatePayout(payout.id, 'paid')} className="rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background">Отметить выплаченной</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 rounded-2xl border bg-card p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск: имя, username, код, Telegram ID" className="h-11 w-full rounded-xl border bg-background px-4 text-sm" />
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Участник</th>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Привёл</th>
                <th className="px-4 py-3">Продажи</th>
                <th className="px-4 py-3">Начислено</th>
                <th className="px-4 py-3">Доступно</th>
                <th className="px-4 py-3">Ожидает</th>
                <th className="px-4 py-3">Токены</th>
                <th className="px-4 py-3">Последняя активность</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.telegramId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.username ? `@${row.username} · ` : ''}{row.telegramId}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.referralCode}</td>
                  <td className="px-4 py-3 font-semibold">{row.invitedCount}</td>
                  <td className="px-4 py-3">{row.salesRub.toFixed(2)} ₽</td>
                  <td className="px-4 py-3">{row.earnedRub.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-emerald-600">{row.availableRub.toFixed(2)} ₽</td>
                  <td className="px-4 py-3 text-amber-600">{row.pendingRub.toFixed(2)} ₽</td>
                  <td className="px-4 py-3">{row.tokenBalance}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString('ru-RU') : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
