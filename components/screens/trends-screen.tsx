'use client'

import { useMemo, useState } from 'react'
import { categories, localize, type CategoryId, type Trend } from '@/lib/data'
import { haptics } from '@/lib/telegram'
import { cn } from '@/lib/utils'
import { CategoryTile } from '../category-tile'
import { useI18n } from '../i18n-provider'
import { TokenBalancePill } from '../tokens'
import { TrendCard } from '../trend-card'
import { useTrends } from '../trends-provider'

type Filter = 'all' | CategoryId

type TrendsScreenProps = {
  onOpenTrend: (trend: Trend) => void
  onOpenCategory: (id: CategoryId) => void
}

export function TrendsScreen({ onOpenTrend, onOpenCategory }: TrendsScreenProps) {
  const { t, locale } = useI18n()
  const { trends } = useTrends()
  const [filter, setFilter] = useState<Filter>('all')
  const trendCategoryIds = useMemo(() => new Set(trends.map((trend) => trend.category)), [trends])
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('home.filterAll') },
    ...categories.filter((c) => trendCategoryIds.has(c.id)).map((c) => ({ id: c.id, label: localize(c.name, locale) })),
  ]
  const visible = filter === 'all' ? trends : trends.filter((trend) => trend.category === filter)
  const [featured, ...rest] = visible

  return (
    <div className="animate-in fade-in duration-300">
      <header className="flex items-center justify-between gap-3 pt-4 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-tight font-semibold tracking-tight">{t('app.name')}</h1>
            <p className="truncate text-xs text-muted-foreground">{t('app.tagline')}</p>
          </div>
        </div>
        <TokenBalancePill />
      </header>

      <section aria-labelledby="trending-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="trending-heading" className="text-lg font-semibold tracking-tight">{t('home.trending')}</h2>
            <p className="text-xs text-muted-foreground">{t('home.trendingHint')}</p>
          </div>
        </div>

        <div role="tablist" aria-label={t('home.filter')} className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {filters.map((item) => {
            const active = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  haptics.selection()
                  setFilter(item.id)
                }}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition active:scale-95',
                  active ? 'bg-foreground text-background' : 'glass text-muted-foreground',
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {featured ? (
          <div className="flex flex-col gap-3">
            <TrendCard trend={featured} onOpen={onOpenTrend} featured />
            {rest.length > 0 && (
              <ul className="grid grid-cols-2 gap-3">
                {rest.map((trend) => (
                  <li key={trend.id}><TrendCard trend={trend} onOpen={onOpenTrend} /></li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="glass rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">{t('home.empty')}</p>
        )}
      </section>

      <section aria-labelledby="create-heading" className="mt-8">
        <h2 id="create-heading" className="text-lg font-semibold tracking-tight">{t('home.create')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('home.createHint')}</p>
        <ul className="grid grid-cols-2 gap-2.5">
          {categories.map((category) => (
            <li key={category.id}><CategoryTile category={category} onOpen={onOpenCategory} /></li>
          ))}
        </ul>
      </section>
    </div>
  )
}
