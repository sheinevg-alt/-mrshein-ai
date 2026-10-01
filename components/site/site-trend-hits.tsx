'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

type Trend = {
  id: string
  title: { en: string; ru?: string }
  image: string
  cardBadge?: 'hit' | 'new' | 'popular'
  aspectRatio?: string
}

export function SiteTrendHits() {
  const [trends, setTrends] = useState<Trend[]>([])

  useEffect(() => {
    void fetch('/api/trends', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (Array.isArray(data?.trends)) setTrends(data.trends.slice(0, 3))
      })
      .catch(() => undefined)
  }, [])

  return (
    <section id="trends" className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-18">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF3D6] px-3 py-1.5 text-xs font-bold text-[#8B5C00]">
            <Sparkles className="size-3.5" />
            ХИТЫ
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] md:text-4xl">Тренды, которые хочется повторить</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758E]">Выберите готовый сценарий, загрузите свои фото и сразу переходите к созданию.</p>
        </div>
        <Link href="/app?tab=trends" className="inline-flex items-center gap-2 self-start rounded-full border border-[#CBD5F3] bg-white px-5 py-3 text-sm font-semibold text-[#1E3A8A] md:self-auto">
          Все тренды <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {trends.length > 0 ? trends.map((trend, index) => (
          <article key={trend.id} className="overflow-hidden rounded-[1.75rem] border border-[#E6EEFF] bg-white shadow-[0_18px_45px_-32px_rgba(30,58,138,0.35)]">
            <div className="relative aspect-[4/5] overflow-hidden bg-[#EDF2FF]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={trend.image} alt={trend.title.ru || trend.title.en} className="size-full object-cover" />
              <div className="absolute left-3 top-3 flex items-center gap-2">
                {(trend.cardBadge || index === 0) && (
                  <span className="rounded-full bg-[#F6AB10] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-[#171A22] shadow-sm">
                    {trend.cardBadge === 'new' ? 'NEW' : trend.cardBadge === 'popular' ? 'ПОПУЛЯРНО' : 'ХИТ'}
                  </span>
                )}
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#334155] backdrop-blur">Видео</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-base font-bold">{trend.title.ru || trend.title.en}</h3>
              <Link
                href={`/app?trend=${encodeURIComponent(trend.id)}`}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1E3A8A] text-sm font-semibold text-white"
              >
                Создать тренд <ArrowRight className="size-4" />
              </Link>
            </div>
          </article>
        )) : [0,1,2].map((item) => (
          <div key={item} className="overflow-hidden rounded-[1.75rem] border border-[#E6EEFF] bg-white">
            <div className="aspect-[4/5] animate-pulse bg-[#EDF2FF]" />
            <div className="p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-[#EDF2FF]" /><div className="mt-4 h-11 animate-pulse rounded-full bg-[#E0E7FF]" /></div>
          </div>
        ))}
      </div>
    </section>
  )
}
