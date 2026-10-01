'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Clapperboard, ImageIcon, MessageSquareText, Music2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'

const menuItems = [
  { label: 'Тренды', href: '/app?tab=trends', icon: Sparkles },
  { label: 'Видео', href: '/app?tab=create&category=video', icon: Clapperboard },
  { label: 'Изображения', href: '/app?tab=create&category=image', icon: ImageIcon },
  { label: 'Аудио', href: '/app?tab=create&category=audio', icon: Music2 },
  { label: 'Чат', href: '/app?tab=create&category=text', icon: MessageSquareText },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

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
          <a href="#trends" className="transition hover:text-[#171A22]">Тренды</a>
          <Link href="/app?tab=create&category=video" className="transition hover:text-[#171A22]">Видео</Link>
          <Link href="/app?tab=create&category=image" className="transition hover:text-[#171A22]">Изображения</Link>
          <a href="#how" className="transition hover:text-[#171A22]">Как работает</a>
        </nav>

        <Link
          href="/app?tab=create"
          className="rounded-full bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(30,58,138,0.75)] transition hover:bg-[#173276]"
        >
          Создать
        </Link>

        {open && (
          <div className="absolute left-5 right-5 top-[68px] z-50 overflow-hidden rounded-3xl border border-[#E6EEFF] bg-white p-2 shadow-[0_24px_60px_-24px_rgba(30,58,138,0.35)] md:left-8 md:right-auto md:w-[360px]">
            <div className="px-3 pb-2 pt-2">
              <p className="text-xs font-semibold text-[#8A97AA]">Что хотите создать?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {menuItems.map(({ label, href, icon: Icon }, index) => (
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
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
