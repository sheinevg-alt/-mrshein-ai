'use client'

import { categories, type CategoryId } from '@/lib/data'
import { CategoryTile } from '../category-tile'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { TokenBalancePill } from '../tokens'

export function CreateScreen({ onOpenCategory }: { onOpenCategory: (id: CategoryId) => void }) {
  const { t } = useI18n()
  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader title={t('create.title')} subtitle={t('create.subtitle')} trailing={<TokenBalancePill />} />
      <ul className="grid grid-cols-2 gap-3">
        {categories.map((category) => (
          <li key={category.id}><CategoryTile category={category} onOpen={onOpenCategory} variant="large" /></li>
        ))}
      </ul>
    </div>
  )
}
