'use client'

import { categories, type CategoryId } from '@/lib/data'
import { CategoryTile } from '../category-tile'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { TokenBalancePill } from '../tokens'

export function CreateScreen({ onOpenCategory }: { onOpenCategory: (id: CategoryId) => void }) {
  const { t, locale } = useI18n()
  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader title={t('create.title')} subtitle={t('create.subtitle')} trailing={<TokenBalancePill />} />
      <div className="mb-4 rounded-2xl border border-banana/25 bg-banana/10 px-4 py-3">
        <p className="text-sm font-semibold">{locale === 'ru' ? 'Шаблоны для быстрого старта + профессиональные AI-модели' : 'Quick templates + professional AI models'}</p>
        <p className="mt-1 text-xs text-muted-foreground">{locale === 'ru' ? 'Все инструменты можно открыть и изучить даже без токенов.' : 'Every tool can be opened and explored even without Tokens.'}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {categories.map((category) => (
          <li key={category.id}><CategoryTile category={category} onOpen={onOpenCategory} variant="large" /></li>
        ))}
      </ul>
    </div>
  )
}
