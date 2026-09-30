'use client'

import { getCategory, getToolsByCategory, localize, type CategoryId, type Tool } from '@/lib/data'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { ToolCard } from '../tool-card'

type CategoryScreenProps = {
  categoryId: CategoryId
  onBack: () => void
  onOpenTool: (tool: Tool) => void
}

export function CategoryScreen({ categoryId, onBack, onOpenTool }: CategoryScreenProps) {
  const { t, locale } = useI18n()
  const category = getCategory(categoryId)
  const tools = getToolsByCategory(categoryId)
  const name = localize(category.name, locale)
  const tagline = localize(category.tagline, locale)

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <ScreenHeader title={name} subtitle={t('category.subtitle', { count: tools.length, tagline })} onBack={onBack} />
      <ul className="grid grid-cols-2 gap-3">
        {tools.map((tool) => (
          <li key={tool.id}><ToolCard tool={tool} onOpen={onOpenTool} /></li>
        ))}
      </ul>
    </div>
  )
}
