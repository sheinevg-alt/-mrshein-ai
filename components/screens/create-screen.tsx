'use client'

import { Clapperboard, Sparkles } from 'lucide-react'
import { categories, type CategoryId } from '@/lib/data'
import { CategoryTile } from '../category-tile'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { TokenBalancePill } from '../tokens'

export function CreateScreen({
  onOpenCategory,
  onOpenSeedance,
}: {
  onOpenCategory: (id: CategoryId) => void
  onOpenSeedance: () => void
}) {
  const { t, locale } = useI18n()
  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader title={t('create.title')} subtitle={t('create.subtitle')} trailing={<TokenBalancePill />} />

      <button
        type="button"
        onClick={onOpenSeedance}
        className="mb-4 flex w-full items-center gap-4 rounded-3xl border border-brand/20 bg-brand-tint/70 p-4 text-left shadow-sm transition active:scale-[0.99]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
          <Clapperboard className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">Seedance 2.5</span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-brand">TEST</span>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {locale === 'ru' ? 'Свой промпт + до 3 референсов через BytePlus API' : 'Your prompt + up to 3 references via BytePlus API'}
          </span>
        </span>
        <Sparkles className="size-5 shrink-0 text-brand" />
      </button>

      <ul className="grid grid-cols-2 gap-3">
        {categories.map((category) => (
          <li key={category.id}><CategoryTile category={category} onOpen={onOpenCategory} variant="large" /></li>
        ))}
      </ul>
    </div>
  )
}
