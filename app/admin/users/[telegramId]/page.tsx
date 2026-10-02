'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'

type Data = {
  exportedAt: string
  user: any
  referralProfile: any
  summary: {
    generations: number
    completed: number
    failed: number
    tokensDebitedForGenerations: number
    tokensRefunded: number
    paidRub: number
  }
  generations: any[]
  ledger: any[]
  payments: any[]
  support: any[]
  audit: any[]
}

function date(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU')
}

function json(value: unknown) {
  try { return JSON.stringify(value ?? {}, null, 2) } catch { return String(value ?? '') }
}

export default function AdminUserAuditPage({ params }: { params: Promise<{ telegramId: string }> }) {
  const [telegramId, setTelegramId] = useState('')
  const [secret, setSecret] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void params.then((value) => setTelegramId(value.telegramId))
    const saved = window.sessionStorage.getItem('mrshein.admin.secret')
    if (saved) setSecret(saved)
  }, [params])

  const headers = useMemo(() => ({ Authorization: `Bearer ${secret}` }), [secret])

  async function load() {
    if (!telegramId || !secret) return
    setStatus('Загружаю операции пользователя…')
    const response = await fetch(`/api/admin/users/${encodeURIComponent(telegramId)}`, { headers, cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setAuthorized(false)
      setStatus(body?.error || 'Не удалось загрузить пользователя')
      return
    }
    window.sessionStorage.setItem('mrshein.admin.secret', secret)
    setAuthorized(true)
    setData(body)
    setStatus('')
  }

  useEffect(() => {
    if (telegramId && secret) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId])

  function download() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `banana-zero-user-${telegramId}-audit-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!authorized || !data) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
        <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
        <h1 className="mt-3 text-3xl font-black">Карточка пользователя</h1>
        <p className="mt-2 text-sm text-muted-foreground">Telegram ID: {telegramId || '…'}</p>
        <label className="mt-8 block text-sm font-medium">Admin Secret</label>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-card px-4" />
        <button type="button" disabled={!secret || !telegramId} onClick={() => void load()} className="brand-gradient mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Открыть карточку</button>
        {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
      </main>
    )
  }

  const u=data.user
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ') || u.username || `ID ${u.telegram_id}`

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 py-7 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO · USER AUDIT</p>
          <h1 className="mt-2 text-3xl font-black">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{u.username ? `@${u.username} · ` : ''}Telegram {u.telegram_id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/control" className="rounded-full border px-4 py-2 text-xs font-semibold">← Control Center</Link>
          <button type="button" onClick={download} className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"><Download className="size-4"/>Досье JSON</button>
          <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"><RefreshCw className="size-4"/>Обновить</button>
        </div>
      </header>

      {status && <div className="mt-4 rounded-2xl bg-brand-tint px-4 py-3 text-sm text-brand">{status}</div>}

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[
          ['Баланс', `${u.token_balance} Tokens`],
          ['Тариф', u.plan_code || 'Free'],
          ['Генераций', data.summary.generations],
          ['Успешно', data.summary.completed],
          ['Ошибок', data.summary.failed],
          ['Списано', `${data.summary.tokensDebitedForGenerations} T`],
          ['Возвращено', `${data.summary.tokensRefunded} T`],
          ['Оплачено', `${data.summary.paidRub.toFixed(2)} ₽`],
        ].map(([label,value]) => (
          <div key={String(label)} className="rounded-2xl border bg-card p-4">
            <p className="text-xl font-black tabular-nums">{String(value)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{String(label)}</p>
          </div>
        ))}
      </section>

      <section className="mt-7">
        <h2 className="text-xl font-black">Генерации</h2>
        <p className="mt-1 text-xs text-muted-foreground">Здесь фиксируются запрос, списание, технический статус, время завершения, возврат и метаданные результата.</p>
        <div className="mt-3 space-y-3">
          {data.generations.map((g) => (
            <article key={g.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{g.title || g.source_id || 'Generation'}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{g.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">{g.token_cost} Tokens</p>
                  <p className={`mt-1 text-xs font-semibold ${g.status === 'completed' ? 'text-emerald-600' : g.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{g.status}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <p>Модель: <span className="text-foreground">{g.model || '—'}</span></p>
                <p>Создано: <span className="text-foreground">{date(g.created_at)}</span></p>
                <p>Завершено: <span className="text-foreground">{date(g.completed_at || g.failed_at)}</span></p>
                <p>Refund: <span className="text-foreground">{date(g.refunded_at)}</span></p>
              </div>
              {g.error_code && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{g.error_code}</p>}
              {g.result_url && <a href={g.result_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">Открыть результат <ExternalLink className="size-3.5"/></a>}
              <details className="mt-3 rounded-xl bg-muted/40 p-3">
                <summary className="cursor-pointer text-xs font-semibold">Параметры и технические метаданные</summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-4">{json({ input: g.input_payload, result: g.result_metadata })}</pre>
              </details>
            </article>
          ))}
          {data.generations.length===0 && <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Генераций пока нет.</p>}
        </div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-black">Операции Tokens</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
            <div className="divide-y">
              {data.ledger.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs">
                  <div><p className="font-semibold">{row.reference || row.event_type}</p><p className="mt-1 text-muted-foreground">{date(row.created_at)}</p></div>
                  <span className={`font-black ${Number(row.amount)>=0?'text-emerald-600':'text-red-600'}`}>{Number(row.amount)>=0?'+':''}{row.amount}</span>
                </div>
              ))}
              {data.ledger.length===0 && <p className="p-5 text-sm text-muted-foreground">Операций нет.</p>}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black">Платежи</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
            <div className="divide-y">
              {data.payments.map((row) => (
                <div key={row.id} className="px-4 py-3 text-xs">
                  <div className="flex justify-between gap-3"><p className="font-semibold">{Number(row.amount||0).toFixed(2)} {row.currency}</p><span>{row.status}</span></div>
                  <p className="mt-1 text-muted-foreground">{row.token_amount} Tokens · {date(row.paid_at || row.created_at)}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{row.external_payment_id || row.id}</p>
                </div>
              ))}
              {data.payments.length===0 && <p className="p-5 text-sm text-muted-foreground">Платежей нет.</p>}
            </div>
          </div>
        </div>
      </section>

      {(data.support.length>0 || data.audit.length>0) && (
        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-black">Обращения в поддержку</h2>
            <div className="mt-3 space-y-2">
              {data.support.map((row) => <div key={row.id} className="rounded-2xl border bg-card p-4 text-xs"><p className="font-semibold">{row.subject || row.status}</p><p className="mt-1 text-muted-foreground">{date(row.created_at)}</p></div>)}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black">Админ-действия</h2>
            <div className="mt-3 space-y-2">
              {data.audit.map((row) => <div key={row.id} className="rounded-2xl border bg-card p-4 text-xs"><p className="font-semibold">{row.action}</p><p className="mt-1 text-muted-foreground">{date(row.created_at)} · {row.actor}</p></div>)}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
