'use client'

import { Sparkle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from './i18n-provider'
import { useUserState } from './user-provider'

function TokenGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn('brand-gradient flex shrink-0 items-center justify-center rounded-full text-white', className)}
      aria-hidden="true"
    >
      <Sparkle className="size-[60%]" fill="currentColor" strokeWidth={0} />
    </span>
  )
}

export function TokenBalancePill() {
  const { t } = useI18n()
  const { tokenBalance } = useUserState()
  return (
    <span
      className="glass inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs"
      aria-label={t('tokens.balance', { count: tokenBalance })}
    >
      <TokenGlyph className="size-5" />
      <span className="font-semibold text-foreground tabular-nums">{tokenBalance}</span>
      <span className="text-muted-foreground">{t('tokens.unit')}</span>
    </span>
  )
}

export function TokenCost({ amount, className }: { amount: number; className?: string }) {
  const { t } = useI18n()
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <TokenGlyph className="size-3.5" />
      <span className="font-medium text-foreground tabular-nums">{amount}</span>
      {t('tokens.unit')}
    </span>
  )
}
