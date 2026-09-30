'use client'

import { Heart } from 'lucide-react'
import { tools, type Tool, type Trend } from '@/lib/data'
import { useFavorites } from '../favorites-provider'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { ToolCard } from '../tool-card'
import { TrendCard } from '../trend-card'
import { useTrends } from '../trends-provider'

type FavoritesScreenProps = {
  onOpenTool: (tool: Tool) => void
  onOpenTrend: (trend: Trend) => void
  onBrowse: () => void
}

export function FavoritesScreen({ onOpenTool, onOpenTrend, onBrowse }: FavoritesScreenProps) {
  const { t } = useI18n()
  const { favorites } = useFavorites()
  const { trends } = useTrends()
  const favTools = tools.filter((tool) => favorites.has(tool.id))
  const favTrends = trends.filter((trend) => favorites.has(trend.id))
  const empty = favTools.length === 0 && favTrends.length === 0

  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader title={t('favorites.title')} subtitle={t('favorites.subtitle')} />

      {empty ? (
        <div className="glass flex flex-col items-center rounded-3xl px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-tint text-brand">
            <Heart className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-medium">{t('favorites.emptyTitle')}</p>
          <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">{t('favorites.emptyBody')}</p>
          <button type="button" onClick={onBrowse} className="brand-gradient mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white active:scale-95">
            {t('favorites.emptyCta')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {favTrends.length > 0 && (
            <section aria-labelledby="fav-trends">
              <h2 id="fav-trends" className="mb-3 text-sm font-medium text-muted-foreground">{t('favorites.trends', { count: favTrends.length })}</h2>
              <ul className="grid grid-cols-2 gap-3">
                {favTrends.map((trend) => <li key={trend.id}><TrendCard trend={trend} onOpen={onOpenTrend} /></li>)}
              </ul>
            </section>
          )}
          {favTools.length > 0 && (
            <section aria-labelledby="fav-tools">
              <h2 id="fav-tools" className="mb-3 text-sm font-medium text-muted-foreground">{t('favorites.tools', { count: favTools.length })}</h2>
              <ul className="grid grid-cols-2 gap-3">
                {favTools.map((tool) => <li key={tool.id}><ToolCard tool={tool} onOpen={onOpenTool} /></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
