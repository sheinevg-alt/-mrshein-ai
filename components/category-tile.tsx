'use client'

import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { getToolsByCategory, localize, type Category, type CategoryId } from '@/lib/data'
import { useI18n } from './i18n-provider'

type CategoryTileProps = {
  category: Category
  onOpen: (id: CategoryId) => void
  variant?: 'compact' | 'large'
}

export function CategoryTile({ category, onOpen, variant = 'compact' }: CategoryTileProps) {
  const { t, locale } = useI18n()
  const Icon = category.icon
  const count = getToolsByCategory(category.id).length
  const name = localize(category.name, locale)
  const tagline = localize(category.tagline, locale)

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => onOpen(category.id)}
        className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.97]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{name}</span>
          <span className="block text-[11px] text-muted-foreground">{t('category.tools', { count })}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(category.id)}
      className="glass relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-3xl p-4 text-left transition active:scale-[0.97]"
    >
      <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-brand-soft/25 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between">
        <span className="brand-gradient flex size-11 items-center justify-center rounded-2xl text-white">
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="relative">
        <p className="text-xl font-semibold tracking-tight">{name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{tagline}</p>
        <p className="mt-2 text-[11px] font-medium text-brand">{t('category.tools', { count })}</p>
      </div>
    </button>
  )
}
