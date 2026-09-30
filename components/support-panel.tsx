'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, ChevronRight, LifeBuoy, MessageCircle, Send } from 'lucide-react'
import type { KnowledgeArticle, KnowledgeCategory } from '@/lib/knowledge'
import { getTelegramInitData } from '@/lib/telegram'
import { useI18n } from './i18n-provider'

type Ticket = {
  id: string
  topic: string
  message: string
  status: 'open' | 'answered' | 'closed'
  admin_reply?: string | null
  created_at: string
  updated_at: string
}

const categories: { id: KnowledgeCategory; label: 'help.gettingStarted' | 'help.generation' | 'help.tokens' | 'help.account' }[] = [
  { id: 'getting-started', label: 'help.gettingStarted' },
  { id: 'generation', label: 'help.generation' },
  { id: 'tokens', label: 'help.tokens' },
  { id: 'account', label: 'help.account' },
]

export function SupportPanel() {
  const { t, locale } = useI18n()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null)
  const [openArticle, setOpenArticle] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [topic, setTopic] = useState<KnowledgeCategory | 'other'>('generation')
  const [message, setMessage] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/knowledge', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.articles)) setArticles(data.articles)
      })
      .catch(() => undefined)

    const initData = getTelegramInitData()
    if (!initData) return
    void fetch('/api/support/tickets', { headers: { 'X-Telegram-Init-Data': initData }, cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.tickets)) setTickets(data.tickets)
      })
      .catch(() => undefined)
  }, [])

  const visibleArticles = useMemo(
    () => selectedCategory ? articles.filter((article) => article.category === selectedCategory) : [],
    [articles, selectedCategory],
  )

  const localize = (value: { en: string; ru?: string }) => locale === 'ru' && value.ru ? value.ru : value.en
  const statusLabel = (value: Ticket['status']) => value === 'answered' ? t('help.answered') : value === 'closed' ? t('help.closed') : t('help.open')

  async function sendTicket() {
    if (message.trim().length < 3) return
    const initData = getTelegramInitData()
    if (!initData) {
      setStatus(t('help.unavailable'))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
        body: JSON.stringify({ topic, message }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Support error')
      setMessage('')
      setStatus(t('help.sent'))
      if (data.ticket) setTickets((current) => [data.ticket, ...current])
    } catch {
      setStatus(t('help.unavailable'))
    } finally {
      setBusy(false)
    }
  }

  if (contactOpen) {
    return (
      <div className="pb-2">
        <button type="button" onClick={() => setContactOpen(false)} className="mb-4 text-xs font-medium text-brand">← {t('help.knowledge')}</button>
        <div className="rounded-2xl bg-brand-tint/60 p-4">
          <div className="flex items-center gap-2"><LifeBuoy className="size-5 text-brand" /><p className="text-sm font-semibold">{t('help.care')}</p></div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('help.intro')}</p>
        </div>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">{t('help.knowledge')}</label>
        <select value={topic} onChange={(event) => setTopic(event.target.value as KnowledgeCategory | 'other')} className="mt-2 h-11 w-full rounded-2xl border bg-card px-3 text-sm">
          {categories.map((item) => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
          <option value="other">{t('help.other')}</option>
        </select>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">{t('help.message')}</label>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder={t('help.messagePlaceholder')} className="mt-2 w-full resize-none rounded-2xl border bg-card p-3 text-sm" />
        <button type="button" disabled={busy || message.trim().length < 3} onClick={() => void sendTicket()} className="brand-gradient mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white disabled:opacity-45">
          <Send className="size-4" />{t('help.send')}
        </button>
        {status && <p className="mt-3 rounded-2xl bg-brand-tint px-3 py-2 text-xs text-brand">{status}</p>}

        {tickets.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold">{t('help.recent')}</h3>
            <div className="mt-2 space-y-2">
              {tickets.slice(0, 5).map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-medium">{ticket.message}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{statusLabel(ticket.status)}</span>
                  </div>
                  {ticket.admin_reply && (
                    <div className="mt-2 rounded-xl bg-brand-tint/60 p-2.5">
                      <p className="text-[10px] font-semibold text-brand">{t('help.reply')}</p>
                      <p className="mt-1 text-xs leading-relaxed">{ticket.admin_reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="pb-2">
      <div className="rounded-2xl bg-brand-tint/60 p-4">
        <div className="flex items-center gap-2"><LifeBuoy className="size-5 text-brand" /><p className="text-sm font-semibold">{t('help.care')}</p></div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('help.intro')}</p>
      </div>

      {!selectedCategory ? (
        <div className="mt-4 space-y-2">
          {categories.map((item) => (
            <button key={item.id} type="button" onClick={() => { setSelectedCategory(item.id); setTopic(item.id) }} className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left active:bg-muted">
              <BookOpen className="size-5 text-brand" />
              <span className="flex-1 text-sm font-medium">{t(item.label)}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <button type="button" onClick={() => { setSelectedCategory(null); setOpenArticle(null) }} className="mb-3 text-xs font-medium text-brand">← {t('help.knowledge')}</button>
          <div className="space-y-2">
            {visibleArticles.map((article) => {
              const opened = openArticle === article.id
              return (
                <button key={article.id} type="button" onClick={() => setOpenArticle(opened ? null : article.id)} className="w-full rounded-2xl border p-4 text-left active:bg-muted">
                  <div className="flex items-center gap-3">
                    <BookOpen className="size-4 shrink-0 text-brand" />
                    <span className="flex-1 text-sm font-medium">{localize(article.title)}</span>
                    <ChevronRight className={`size-4 text-muted-foreground transition ${opened ? 'rotate-90' : ''}`} />
                  </div>
                  {opened && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{localize(article.body)}</p>}
                </button>
              )
            })}
            {visibleArticles.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">{t('help.noArticles')}</p>}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 text-brand" />
          <div className="flex-1"><p className="text-sm font-medium">{t('help.notHelped')}</p><p className="mt-1 text-xs text-muted-foreground">{t('help.contact')}</p></div>
        </div>
        <button type="button" onClick={() => setContactOpen(true)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold text-brand active:scale-[0.98]">
          <MessageCircle className="size-4" />{t('help.contact')}
        </button>
      </div>
    </div>
  )
}
