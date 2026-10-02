'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Bell, Send } from 'lucide-react'

type Announcement = {
  id: string
  kind: string
  title_ru: string
  body_ru: string
  title_en: string
  body_en: string
  link_url?: string | null
  is_published: boolean
  published_at?: string | null
  created_at: string
}

export default function AdminAnnouncementsPage() {
  const [secret, setSecret] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [items, setItems] = useState<Announcement[]>([])
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('info')
  const [titleRu, setTitleRu] = useState('')
  const [bodyRu, setBodyRu] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mrshein.admin.secret')
    if (saved) setSecret(saved)
  }, [])

  const headers = useMemo(() => ({ Authorization: `Bearer ${secret}` }), [secret])

  async function load() {
    setStatus('Загружаю…')
    const response = await fetch('/api/admin/announcements', { headers, cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setAuthorized(false)
      setStatus(data?.error || 'Ошибка авторизации')
      return
    }
    window.sessionStorage.setItem('mrshein.admin.secret', secret)
    setAuthorized(true)
    setItems(data.announcements || [])
    setStatus('')
  }

  async function publish() {
    if (!titleRu.trim() || !bodyRu.trim()) {
      setStatus('Нужны заголовок и текст на русском.')
      return
    }
    setBusy(true)
    setStatus('')
    const response = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        titleRu,
        bodyRu,
        titleEn: titleEn || titleRu,
        bodyEn: bodyEn || bodyRu,
        linkUrl,
        publish: true,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(data?.error || 'Не удалось опубликовать уведомление.')
      setBusy(false)
      return
    }
    setTitleRu('')
    setBodyRu('')
    setTitleEn('')
    setBodyEn('')
    setLinkUrl('')
    setStatus('Уведомление опубликовано. Колокольчик загорится у пользователей.')
    await load()
    setBusy(false)
  }

  if (!authorized) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
        <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
        <h1 className="mt-3 text-3xl font-black">Уведомления</h1>
        <p className="mt-2 text-sm text-muted-foreground">Новости моделей, цен, обслуживания и промо для пользователей.</p>
        <label className="mt-8 block text-sm font-medium">Admin Secret</label>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-card px-4" />
        <button type="button" disabled={!secret} onClick={() => void load()} className="brand-gradient mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Открыть</button>
        {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-7 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-brand">BANANA ZERO ADMIN</p>
          <h1 className="mt-2 text-3xl font-black">Уведомления</h1>
          <p className="mt-1 text-sm text-muted-foreground">Публикация в колокольчик сайта и Mini App.</p>
        </div>
        <Link href="/admin/control" className="rounded-full border px-4 py-2 text-xs font-semibold">← Control Center</Link>
      </header>

      {status && <div className="mt-4 rounded-2xl bg-brand-tint px-4 py-3 text-sm text-brand">{status}</div>}

      <section className="mt-6 rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-tint text-brand"><Bell className="size-5" /></span>
          <div>
            <h2 className="font-bold">Новое уведомление</h2>
            <p className="text-xs text-muted-foreground">Русская версия обязательна. Английскую можно заполнить отдельно.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted-foreground">Тип
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground">
              <option value="info">Информация</option>
              <option value="price">Цена</option>
              <option value="model">Модель</option>
              <option value="maintenance">Техработы</option>
              <option value="promo">Промо</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Ссылка
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/#pricing или /app?tab=create" className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">Заголовок RU
            <input value={titleRu} onChange={(e) => setTitleRu(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">Заголовок EN
            <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">Текст RU
            <textarea rows={4} value={bodyRu} onChange={(e) => setBodyRu(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">Текст EN
            <textarea rows={4} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3 text-sm" />
          </label>
        </div>

        <button type="button" disabled={busy || !titleRu.trim() || !bodyRu.trim()} onClick={() => void publish()} className="brand-gradient mt-4 flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-40">
          <Send className="size-4" />{busy ? 'Публикую…' : 'Опубликовать'}
        </button>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-black">История</h2>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{item.title_ru}</p>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase">{item.kind}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body_ru}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{item.published_at ? new Date(item.published_at).toLocaleString('ru-RU') : 'Черновик'}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
