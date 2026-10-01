'use client'

import {
  getCategory,
  getModelToolsByCategory,
  getQuickToolsByCategory,
  localize,
  type CategoryId,
  type Tool,
  type Trend,
} from '@/lib/data'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { ToolCard } from '../tool-card'
import { TrendCard } from '../trend-card'
import { useTrends } from '../trends-provider'

type CategoryScreenProps = {
  categoryId: CategoryId
  onBack: () => void
  onOpenTool: (tool: Tool) => void
  onOpenTrend: (trend: Trend) => void
}

export function CategoryScreen({ categoryId, onBack, onOpenTool, onOpenTrend }: CategoryScreenProps) {
  const { locale } = useI18n()
  const { trends } = useTrends()
  const category = getCategory(categoryId)
  const modelTools = getModelToolsByCategory(categoryId)
  const quickTools = getQuickToolsByCategory(categoryId)
  const categoryTrends = trends.filter((trend) => trend.category === categoryId)
  const name = localize(category.name, locale)
  const tagline = localize(category.tagline, locale)

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <ScreenHeader title={name} subtitle={tagline} onBack={onBack} />

      {categoryTrends.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{locale === 'ru' ? 'Готовые тренды и шаблоны' : 'Ready trends & templates'}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{locale === 'ru' ? 'Для быстрого результата без сложных настроек' : 'Fast results without complex settings'}</p>
            </div>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {categoryTrends.slice(0, 8).map((trend) => (
              <TrendCard key={trend.id} trend={trend} onOpen={onOpenTrend} className="w-[190px] shrink-0" />
            ))}
          </div>
        </section>
      )}

      <section className={categoryTrends.length ? 'mt-7' : ''}>
        <div className="mb-3">
          <h2 className="text-base font-semibold">{locale === 'ru' ? 'AI-модели' : 'AI models'}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{locale === 'ru' ? 'Профессиональный режим — все модели видны независимо от баланса' : 'Professional mode — all models stay visible regardless of balance'}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {modelTools.map((tool) => (
            <li key={tool.id}><ToolCard tool={tool} onOpen={onOpenTool} /></li>
          ))}
        </ul>
      </section>

      {quickTools.length > 0 && (
        <section className="mt-7">
          <div className="mb-3">
            <h2 className="text-base font-semibold">{locale === 'ru' ? 'Быстрые инструменты' : 'Quick tools'}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{locale === 'ru' ? 'Готовые действия для частых задач' : 'Ready actions for common jobs'}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {quickTools.map((tool) => (
              <li key={tool.id}><ToolCard tool={tool} onOpen={onOpenTool} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
