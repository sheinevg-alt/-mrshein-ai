'use client'

import { Clapperboard, Flame, Heart, Sparkles, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from './i18n-provider'

export type TabId = 'trends' | 'create' | 'works' | 'favorites' | 'profile'

const items: { id: TabId; en: string; ru: string; icon: LucideIcon }[] = [
  { id: 'trends', en: 'Trends', ru: 'Тренды', icon: Flame },
  { id: 'create', en: 'Create', ru: 'Создать', icon: Sparkles },
  { id: 'works', en: 'My works', ru: 'Мои работы', icon: Clapperboard },
  { id: 'favorites', en: 'Favorites', ru: 'Избранное', icon: Heart },
  { id: 'profile', en: 'Profile', ru: 'Профиль', icon: User },
]

export function BottomNav({ active, onChange, worksBadge = false }: {
  active: TabId
  onChange: (tab: TabId) => void
  worksBadge?: boolean
}) {
  const { t, locale } = useI18n()
  return (
    <nav
      aria-label={t('nav.label')}
      className="glass-strong fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0"
      style={{ paddingBottom: 'var(--app-safe-bottom)' }}
    >
      <ul className="mx-auto grid h-[var(--nav-height)] w-full max-w-md grid-cols-5">
        {items.map(({ id, en, ru, icon: Icon }) => {
          const isActive = active === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] font-medium transition-colors active:scale-95',
                  isActive ? (id === 'create' ? 'text-banana' : 'text-brand') : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon
                    className="size-[21px]"
                    strokeWidth={isActive ? 2.1 : 1.7}
                    fill={isActive && (id === 'favorites' || id === 'trends') ? 'currentColor' : 'none'}
                    fillOpacity={id === 'trends' ? 0.15 : 1}
                    aria-hidden="true"
                  />
                  {id === 'works' && worksBadge && !isActive && (
                    <span className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full bg-brand ring-2 ring-white" aria-label={locale === 'ru' ? 'Есть новая готовая работа' : 'New completed work'} />
                  )}
                </span>
                <span className="max-w-full truncate">{locale === 'ru' ? ru : en}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
