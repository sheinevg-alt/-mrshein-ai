'use client'

import { ChevronLeft } from 'lucide-react'
import { useI18n } from './i18n-provider'

type ScreenHeaderProps = {
  title: string
  subtitle?: string
  onBack?: () => void
  trailing?: React.ReactNode
}

export function ScreenHeader({ title, subtitle, onBack, trailing }: ScreenHeaderProps) {
  const { t } = useI18n()
  return (
    <header className="flex items-center justify-between gap-3 pt-4 pb-5">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('common.back')}
            className="glass flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {trailing}
    </header>
  )
}
