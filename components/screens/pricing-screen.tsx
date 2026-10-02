'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BadgePercent, WalletCards } from 'lucide-react'
import { PUBLIC_PLANS, PUBLIC_TOKEN_PACKS } from '@/lib/public-pricing'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { TokenBalancePill } from '../tokens'

export function PricingScreen() {
  const { locale } = useI18n()
  const ru = locale === 'ru'
  const [packIndex, setPackIndex] = useState(1)
  const pack = PUBLIC_TOKEN_PACKS[packIndex]

  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader
        title={ru ? 'Тарифы' : 'Pricing'}
        subtitle={ru ? 'Тарифы и разовая покупка Tokens' : 'Plans and one-time Token purchases'}
        trailing={<TokenBalancePill />}
      />

      <div className="space-y-3">
        {PUBLIC_PLANS.map((plan) => (
          <article key={plan.code} className="relative overflow-hidden rounded-3xl border bg-card p-4">
            <span className="absolute right-3 top-3 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-black text-emerald-700">
              −{plan.discountPct}%
            </span>
            <div className="pr-16">
              <p className="text-base font-bold">{plan.name}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <span className="text-sm text-muted-foreground line-through">{plan.regularRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
                <span className="text-2xl font-black">{plan.priceRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
                <span className="pb-1 text-xs text-muted-foreground">/ 30 {ru ? 'дней' : 'days'}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{plan.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {ru
                  ? 'Цена уже указана с выгодой тарифа. Дополнительная скидка после покупки не подразумевается.'
                  : 'The displayed price already includes the plan discount. No additional discount is implied after purchase.'}
              </p>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-5 rounded-3xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-tint text-brand"><WalletCards className="size-5" /></span>
          <div>
            <p className="text-sm font-bold">{ru ? 'Купить Tokens отдельно' : 'Buy Tokens separately'}</p>
            <p className="text-xs text-muted-foreground">{ru ? 'Без тарифа и без подписки' : 'No plan or subscription required'}</p>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-3xl font-black">{pack.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens</p>
          <p className="mt-1 text-lg font-semibold">{pack.priceRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</p>
        </div>

        <input
          type="range"
          min={0}
          max={PUBLIC_TOKEN_PACKS.length - 1}
          step={1}
          value={packIndex}
          onChange={(event) => setPackIndex(Number(event.target.value))}
          className="mt-5 w-full"
          aria-label={ru ? 'Количество Tokens' : 'Token amount'}
        />

        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {PUBLIC_TOKEN_PACKS.map((item) => <span key={item.tokens}>{item.tokens}</span>)}
        </div>

        <Link href={`/pay?tokens=${pack.tokens}`} className="brand-gradient mt-5 flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white">
          {ru ? `Купить за ${pack.priceRub.toLocaleString('ru-RU')} ₽` : `Buy for ${pack.priceRub.toLocaleString('en-US')} RUB`}
        </Link>
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
        <BadgePercent className="mt-0.5 size-4 shrink-0" />
        <p>{ru ? 'Процент на карточке — уже применённая выгода тарифа относительно обычной стоимости такого объёма Tokens.' : 'The percentage on each card is the discount already reflected in the displayed plan price.'}</p>
      </div>
    </div>
  )
}
