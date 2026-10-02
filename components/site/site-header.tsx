'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Clapperboard, ImageIcon, MessageSquareText, Music2, Sparkles, WalletCards, X } from 'lucide-react'
import { useState } from 'react'
import { useSiteLocale } from './site-locale-provider'
import { AnnouncementsBell } from '../announcements-bell'

const menuItems = [
  { ru: 'Тренды', en: 'Trends', href: '/app?tab=trends', icon: Sparkles },
  { ru: 'Видео', en: 'Video', href: '/app?tab=create&category=video', icon: Clapperboard },
  { ru: 'Изображения', en: 'Images', href: '/app?tab=create&category=image', icon: ImageIcon },
  { ru: 'Аудио', en: 'Audio', href: '/app?tab=create&category=audio', icon: Music2 },
  { ru: 'Чат', en: 'Text', href: '/app?tab=create&category=text', icon: MessageSquareText },
  { ru: 'Тарифы', en: 'Pricing', href: '/#pricing', icon: WalletCards },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { locale, toggleLocale } = useSiteLocale()

  return (
    <header className="sticky top-0 z-40 border-b border-[#E6EEFF]/80 bg-[#F8FAFF]/90 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-3 rounded-full pr-3 text-left transition active:scale-[0.98]"
        >
          <span className="relative size-11 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
            <Image src="/banana-zero-cake.jpg" alt="Banana Zero" fill sizes="44px" className="object-cover" priority />
          </span>
          <span className="text-lg font-bold tracking-tight">Banana <span className="text-[#1E3A8A]">Zero</span></span>
          {open ? <X className="size-4 text-[#66758E]" /> : <ChevronDown className="size-4 text-[#66758E]" />}
        </button>

        <nav className="hidden items-center gap-7 text-sm text-[#66758E] md:flex">
          <a href="#trends" className="transition hover:text-[#171A22]">{locale === 'ru' ? 'Тренды' : 'Trends'}</a>
          <Link href="/app?tab=create&category=video" className="transition hover:text-[#171A22]">{locale === 'ru' ? 'Видео' : 'Video'}</Link>
          <Link href="/app?tab=create&category=image" className="transition hover:text-[#171A22]">{locale === 'ru' ? 'Изображения' : 'Images'}</Link>
          <a href="#how" className="transition hover:text-[#171A22]">{locale === 'ru' ? 'Как работает' : 'How it works'}</a>
          <a href="#pricing" className="transition hover:text-[#171A22]">{locale === 'ru' ? 'Тарифы' : 'Pricing'}</a>
        </nav>

        <div className="flex items-center gap-2">
          <AnnouncementsBell locale={locale} variant="site" />
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-full border border-[#DCE5F7] bg-white px-3 py-2 text-xs font-bold text-[#334155]"
            aria-label={locale === 'ru' ? 'Switch to English' : 'Переключить на русский'}
          >
            {locale === 'ru' ? 'RU · EN' : 'EN · RU'}
          </button>
          <Link
            href="/app?tab=create"
            className="rounded-full bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(30,58,138,0.75)] transition hover:bg-[#173276]"
          >
            {locale === 'ru' ? 'Создать' : 'Create'}
          </Link>
        </div>

        {open && (
          <div className="absolute left-5 right-5 top-[68px] z-50 overflow-hidden rounded-3xl border border-[#E6EEFF] bg-white p-2 shadow-[0_24px_60px_-24px_rgba(30,58,138,0.35)] md:left-8 md:right-auto md:w-[360px]">
            <div className="px-3 pb-2 pt-2">
              <p className="text-xs font-semibold text-[#8A97AA]">{locale === 'ru' ? 'Что хотите создать?' : 'What do you want to create?'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {menuItems.map(({ ru, en, href, icon: Icon }, index) => { const label = locale === 'ru' ? ru : en; return (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-semibold transition active:scale-[0.98] ${index === 0 ? 'border-[#F6AB10]/30 bg-[#FFF8E8]' : 'border-[#E6EEFF] bg-[#F8FAFF]'}`}
                >
                  <span className={`flex size-9 items-center justify-center rounded-xl ${index === 0 ? 'bg-[#F6AB10] text-[#171A22]' : 'bg-[#E0E7FF] text-[#1E3A8A]'}`}>
                    <Icon className="size-4" />
                  </span>
                  {label}
                </Link>
              )})}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
