'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PUBLIC_PLANS, PUBLIC_TOKEN_PACKS } from '@/lib/public-pricing'
import { useSiteLocale } from './site-locale-provider'

export function SitePricing() {
  const { locale } = useSiteLocale()
  const ru = locale === 'ru'
  const [packIndex, setPackIndex] = useState(1)
  const pack = PUBLIC_TOKEN_PACKS[packIndex]

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:px-8">
      <div className="rounded-[2rem] bg-[#0B0F1A] px-6 py-10 text-white md:px-10 md:py-12">
        <p className="text-xs font-bold tracking-[0.16em] text-[#F6AB10]">{ru ? 'ТАРИФЫ' : 'PRICING'}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">{ru ? 'Стоимость цифровых услуг Banana Zero' : 'Banana Zero digital service pricing'}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#A8B3C7]">
          {ru
            ? 'Все цены указаны в рублях и доступны до оплаты. Цена на карточке тарифа уже включает указанную скидку — дополнительная скидка после покупки не подразумевается.'
            : 'All prices are shown in RUB before payment. The price on each plan card already includes the displayed discount; no additional discount is implied after purchase.'}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PUBLIC_PLANS.map((plan) => (
            <article key={plan.code} className={`relative rounded-3xl border p-5 ${plan.code === 'creator' ? 'border-[#F6AB10]/60 bg-white/[0.09]' : 'border-white/10 bg-white/[0.05]'}`}>
              <span className="absolute right-4 top-4 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-black text-[#10251B]">−{plan.discountPct}%</span>
              <p className="text-lg font-bold">{plan.name}</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <span className="text-sm text-[#7F8BA0] line-through">{plan.regularRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
                <span className="text-3xl font-black">{plan.priceRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</span>
                <span className="pb-1 text-sm font-medium text-[#8F9DB3]">/ 30 {ru ? 'дней' : 'days'}</span>
              </div>
              <p className="mt-4 text-sm font-semibold">{plan.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens {ru ? 'включено' : 'included'}</p>
              <p className="mt-2 text-xs leading-5 text-[#8F9DB3]">
                {ru ? 'Процент уже учтён в цене тарифа.' : 'The discount is already reflected in the plan price.'}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
          <div>
            <p className="text-base font-bold">{ru ? 'Купить Tokens отдельно' : 'Buy Tokens separately'}</p>
            <p className="mt-1 text-xs text-[#8F9DB3]">{ru ? 'Без тарифа и без подписки. Выберите объём бегунком.' : 'No plan or subscription required. Choose an amount with the slider.'}</p>
          </div>

          <div className="mt-5 text-center">
            <p className="text-3xl font-black">{pack.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens</p>
            <p className="mt-1 text-xl font-semibold">{pack.priceRub.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</p>
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
          <div className="mt-2 flex justify-between text-[10px] text-[#8F9DB3]">
            {PUBLIC_TOKEN_PACKS.map((item) => <span key={item.tokens}>{item.tokens}</span>)}
          </div>

          <Link href={`/pay?tokens=${pack.tokens}`} className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-[#171A22] md:w-auto md:px-6">
            {ru ? `Купить за ${pack.priceRub.toLocaleString('ru-RU')} ₽` : `Buy for ${pack.priceRub.toLocaleString('en-US')} RUB`}
          </Link>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#8F9DB3]">
          {ru
            ? 'Процент скидки округлён до целого значения относительно обычной стоимости такого объёма Tokens. Стоимость каждой AI-генерации показывается в Tokens до запуска.'
            : 'The discount percentage is rounded to a whole number relative to the regular value of the included Tokens. Each AI generation shows its Token price before launch.'}
        </p>
      </div>
    </section>
  )
}
