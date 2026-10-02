'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, ChevronRight, X } from 'lucide-react'

type Announcement = {
  id: string
  kind: 'info' | 'price' | 'model' | 'maintenance' | 'promo'
  title_ru: string
  title_en: string
  body_ru: string
  body_en: string
  link_url?: string | null
  published_at?: string | null
}

export function AnnouncementsBell({ locale = 'ru', variant = 'app' }: { locale?: 'ru' | 'en'; variant?: 'app' | 'site' }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState('')

  useEffect(() => {
    setLastSeen(window.localStorage.getItem('banana-zero.announcements.last-seen') || '')
    void fetch('/api/announcements', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setItems(Array.isArray(data?.announcements) ? data.announcements : []))
      .catch(() => undefined)
  }, [])

  const latestPublished = useMemo(() => items[0]?.published_at || '', [items])
  const unread = Boolean(latestPublished && (!lastSeen || new Date(latestPublished).getTime() > new Date(lastSeen).getTime()))

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && latestPublished) {
      setLastSeen(latestPublished)
      window.localStorage.setItem('banana-zero.announcements.last-seen', latestPublished)
    }
  }

  const buttonClass = variant === 'site'
    ? 'relative flex size-10 items-center justify-center rounded-full border border-[#DCE5F7] bg-white text-[#334155]'
    : 'glass relative flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition active:scale-95'

  return (
    <div className="relative">
      <button type="button" onClick={toggle} className={buttonClass} aria-label={locale === 'ru' ? 'Уведомления' : 'Notifications'}>
        {open ? <X className="size-4" /> : <Bell className="size-4" />}
        {unread && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div className={variant === 'site'
          ? 'absolute right-0 top-12 z-[70] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#E6EEFF] bg-white shadow-[0_24px_60px_-24px_rgba(30,58,138,0.35)]'
          : 'absolute right-0 top-12 z-[70] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-3xl border bg-card shadow-2xl'}>
          <div className="border-b px-4 py-3">
            <p className="text-sm font-bold">{locale === 'ru' ? 'Новости Banana Zero' : 'Banana Zero updates'}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{locale === 'ru' ? 'Изменения моделей, цен и сервиса' : 'Model, pricing and service changes'}</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">{locale === 'ru' ? 'Пока новых уведомлений нет' : 'No updates yet'}</p>
            ) : items.map((item) => {
              const title = locale === 'ru' ? item.title_ru : item.title_en
              const body = locale === 'ru' ? item.body_ru : item.body_en
              const date = item.published_at ? new Date(item.published_at) : null
              const content = (
                <div className="flex gap-3 px-4 py-3.5">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${item.kind === 'price' ? 'bg-amber-500' : item.kind === 'maintenance' ? 'bg-red-500' : item.kind === 'promo' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                    {date && <p className="mt-1.5 text-[10px] text-muted-foreground">{date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}</p>}
                  </div>
                  {item.link_url && <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />}
                </div>
              )
              return item.link_url
                ? <a key={item.id} href={item.link_url} onClick={() => setOpen(false)} className="block border-b last:border-b-0 hover:bg-muted/40">{content}</a>
                : <div key={item.id} className="border-b last:border-b-0">{content}</div>
            })}
          </div>
        </div>
      )}
    </div>
  )
}
