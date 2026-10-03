'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BadgePercent, WalletCards } from 'lucide-react'
import { PUBLIC_PLANS, TOKEN_PURCHASE_MAX, TOKEN_PURCHASE_MIN, TOKEN_PURCHASE_STEP, getTokenPurchaseQuote } from '@/lib/public-pricing'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { TokenBalancePill } from '../tokens'
import { getTelegramInitData } from '@/lib/telegram'

export function PricingScreen() {
  const { locale } = useI18n()
  const ru = locale === 'ru'
  const [tokenAmount, setTokenAmount] = useState(500)
  const [testCheckout, setTestCheckout] = useState<{ enabled: boolean; amountRub: number; tokenAmount: number } | null>(null)
  const pack = getTokenPurchaseQuote(tokenAmount)

  useEffect(() => {
    const initData = getTelegramInitData()
    if (!initData) return

    void fetch('/api/payments/tochka/test-access', {
      headers: { 'X-Telegram-Init-Data': initData },
      cache: 'no-store',
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.enabled) {
          setTestCheckout({
            enabled: true,
            amountRub: Number(data.amountRub || 100),
            tokenAmount: Number(data.tokenAmount || 100),
          })
        }
      })
      .catch(() => undefined)
  }, [])

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
          <div className="mt-1 flex items-center justify-center gap-2">
            {pack.discountPct > 0 && (
              <span className="text-sm text-muted-foreground line-through">{pack.regularRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
            )}
            <span className="text-xl font-black">{pack.priceRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
            {pack.discountPct > 0 && (
              <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-black text-emerald-700">−{pack.discountPct}%</span>
            )}
          </div>
          {pack.savingsRub > 0 && (
            <p className="mt-1 text-xs font-medium text-emerald-700">{ru ? `Экономия ${pack.savingsRub.toLocaleString('ru-RU')} ₽` : `Save ${pack.savingsRub.toLocaleString('en-US')} RUB`}</p>
          )}
        </div>

        <input
          type="range"
          min={TOKEN_PURCHASE_MIN}
          max={TOKEN_PURCHASE_MAX}
          step={TOKEN_PURCHASE_STEP}
          value={tokenAmount}
          onChange={(event) => setTokenAmount(Number(event.target.value))}
          className="mt-5 w-full"
          aria-label={ru ? 'Количество Tokens' : 'Token amount'}
        />

        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>200</span><span>1000</span><span>2000</span><span>3000</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
          <span className={tokenAmount >= 1000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>1000+ · −8%</span>
          <span className={tokenAmount >= 2000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>2000+ · −10%</span>
          <span className={tokenAmount >= 3000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>3000 · −13%</span>
        </div>

        <Link href={`/pay?tokens=${pack.tokens}`} className="brand-gradient mt-5 flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold text-white">
          {ru ? `Купить за ${pack.priceRub.toLocaleString('ru-RU')} ₽` : `Buy for ${pack.priceRub.toLocaleString('en-US')} RUB`}
        </Link>

        {testCheckout?.enabled && (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{ru ? 'Тестовый платёж' : 'Test payment'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {testCheckout.tokenAmount.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens · {testCheckout.amountRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽
                </p>
              </div>
              <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                {ru ? 'Только для теста' : 'Test only'}
              </span>
            </div>
            <Link
              href="/pay?test=1"
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-amber-500/40 bg-card text-sm font-semibold"
            >
              {ru ? `Оплатить ${testCheckout.amountRub.toLocaleString('ru-RU')} ₽` : `Pay ${testCheckout.amountRub.toLocaleString('en-US')} RUB`}
            </Link>
          </div>
        )}
      </section>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
        <BadgePercent className="mt-0.5 size-4 shrink-0" />
        <p>{ru ? 'Процент на карточке — уже применённая выгода тарифа относительно обычной стоимости такого объёма Tokens.' : 'The percentage on each card is the discount already reflected in the displayed plan price.'}</p>
      </div>
    </div>
  )
}
