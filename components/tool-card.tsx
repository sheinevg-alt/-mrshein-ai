'use client'

import { Heart } from 'lucide-react'
import { getToolTokens, localize, type Tool } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useFavorites } from './favorites-provider'
import { useI18n } from './i18n-provider'
import { TokenCost } from './tokens'

export function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: (tool: Tool) => void }) {
  const { t, locale } = useI18n()
  const { isFavorite, toggleFavorite } = useFavorites()
  const fav = isFavorite(tool.id)
  const Icon = tool.icon
  const name = localize(tool.name, locale)
  const description = localize(tool.description, locale)
  const badgeLabel = tool.badge ? t(tool.badge === 'New' ? 'badge.new' : tool.badge === 'Pro' ? 'badge.pro' : 'badge.popular') : null

  return (
    <div className="glass relative flex h-full flex-col rounded-2xl p-4 transition active:scale-[0.98]">
      <button type="button" onClick={() => onOpen(tool)} className="absolute inset-0 rounded-2xl" aria-label={name} />
      <div className="flex items-start justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={() => toggleFavorite(tool.id)}
          aria-label={t(fav ? 'favorites.remove' : 'favorites.add', { name })}
          aria-pressed={fav}
          className="relative -mt-1 -mr-1 flex size-8 items-center justify-center rounded-full transition active:scale-90"
        >
          <Heart className={cn('size-4', fav ? 'text-brand' : 'text-muted-foreground')} fill={fav ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>
      </div>
      <div className="pointer-events-none mt-5 flex flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[15px] leading-tight font-medium">{name}</h3>
          {tool.badge && badgeLabel && (
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[9px] font-semibold tracking-wide uppercase',
                tool.badge === 'New' && 'bg-brand text-brand-foreground',
                tool.badge === 'Pro' && 'border border-brand/30 text-brand',
                tool.badge === 'Popular' && 'bg-brand-tint text-brand',
              )}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <TokenCost amount={getToolTokens(tool)} className="mt-auto pt-3" />
      </div>
    </div>
  )
}
