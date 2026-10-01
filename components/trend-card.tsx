'use client'

import { Heart, Sparkles } from 'lucide-react'
import { getCategory, localize, type Trend } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useFavorites } from './favorites-provider'
import { useI18n } from './i18n-provider'
import { TokenCost } from './tokens'

type TrendCardProps = {
  trend: Trend
  onOpen: (trend: Trend) => void
  featured?: boolean
  className?: string
}

function ratioStyle(ratio?: string) {
  const [w, h] = String(ratio || '4:5').split(':').map(Number)
  return w > 0 && h > 0 ? { aspectRatio: `${w} / ${h}` } : { aspectRatio: '4 / 5' }
}

export function TrendCard({ trend, onOpen, featured = false, className }: TrendCardProps) {
  const { t, locale } = useI18n()
  const { isFavorite, toggleFavorite } = useFavorites()
  const fav = isFavorite(trend.id)
  const title = localize(trend.title, locale)
  const category = localize(getCategory(trend.category).name, locale)

  return (
    <article className={cn('glass flex h-full flex-col overflow-hidden rounded-3xl p-1.5', className)}>
      <div
        className={cn('relative mx-auto w-full overflow-hidden rounded-[1.1rem] bg-muted', featured && trend.aspectRatio === '9:16' && 'max-w-[22rem]')}
        style={ratioStyle(trend.aspectRatio || (featured ? '16:11' : '4:5'))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- trends may come from remote admin URLs */}
        <img src={trend.image} alt={`${title} example`} className="absolute inset-0 size-full object-cover" />
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => onOpen(trend)} className="absolute inset-0 transition active:bg-white/10" />
        {trend.cardBadge ? (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] shadow-lg',
                trend.cardBadge === 'popular'
                  ? 'border-white/35 bg-foreground/90 text-background'
                  : 'border-transparent bg-banana text-[#171A22]',
              )}
            >
              {trend.cardBadge === 'hit'
                ? (locale === 'ru' ? 'ХИТ' : 'HIT')
                : trend.cardBadge === 'new'
                  ? 'NEW'
                  : (locale === 'ru' ? 'ПОПУЛЯРНО' : 'POPULAR')}
            </span>
            <span className="glass rounded-full px-2 py-0.5 text-[10px] font-medium text-foreground">{category}</span>
          </div>
        ) : (
          <span className="glass absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-foreground">{category}</span>
        )}
        <button
          type="button"
          onClick={() => toggleFavorite(trend.id)}
          aria-label={t(fav ? 'favorites.remove' : 'favorites.add', { name: title })}
          aria-pressed={fav}
          className="glass absolute top-2 right-2 flex size-8 items-center justify-center rounded-full transition active:scale-90"
        >
          <Heart className={cn('size-4', fav ? 'text-brand' : 'text-foreground')} fill={fav ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>
      </div>

      <div className={cn('flex flex-1 gap-3 px-2 pt-2.5 pb-1.5', featured ? 'items-center justify-between' : 'flex-col')}>
        <div className="min-w-0">
          <h3 className={cn('truncate leading-snug font-semibold', featured ? 'text-base' : 'text-sm')}>{title}</h3>
          <TokenCost amount={trend.tokens} className="mt-1" />
        </div>
        <button
          type="button"
          onClick={() => onOpen(trend)}
          className={cn(
            'brand-gradient flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold text-white shadow-[0_6px_16px_-8px_oklch(0.5_0.21_264/0.7)] transition active:scale-95',
            featured ? 'h-10 px-4 text-sm' : 'mt-auto h-9 w-full text-[13px]',
          )}
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t('trend.use')}
          <span className="sr-only">: {title}</span>
        </button>
      </div>
    </article>
  )
}
