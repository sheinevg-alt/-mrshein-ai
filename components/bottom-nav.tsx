'use client'

import { Flame, Heart, Sparkles, User, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useI18n } from './i18n-provider'

export type TabId = 'trends' | 'create' | 'favorites' | 'profile'

const items: { id: TabId; label: MessageKey; icon: LucideIcon }[] = [
  { id: 'trends', label: 'nav.trends', icon: Flame },
  { id: 'create', label: 'nav.create', icon: Sparkles },
  { id: 'favorites', label: 'nav.favorites', icon: Heart },
  { id: 'profile', label: 'nav.profile', icon: User },
]

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const { t } = useI18n()
  return (
    <nav
      aria-label={t('nav.label')}
      className="glass-strong fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0"
      style={{ paddingBottom: 'var(--app-safe-bottom)' }}
    >
      <ul className="mx-auto grid h-[var(--nav-height)] w-full max-w-md grid-cols-4">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-95',
                  isActive ? 'text-brand' : 'text-muted-foreground',
                )}
              >
                <Icon
                  className="size-[22px]"
                  strokeWidth={isActive ? 2.1 : 1.7}
                  fill={isActive && (id === 'favorites' || id === 'trends') ? 'currentColor' : 'none'}
                  fillOpacity={id === 'trends' ? 0.15 : 1}
                  aria-hidden="true"
                />
                <span>{t(label)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
