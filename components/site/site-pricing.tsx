'use client'

import Link from 'next/link'
import { useSiteLocale } from './site-locale-provider'

const plans = [
  { name: 'Beginner', price: 1490, tokens: 630, discount: 5, ru: 'Для знакомства с Banana Zero и регулярных небольших генераций.', en: 'For getting started and regular light generation.' },
  { name: 'Creator', price: 2990, tokens: 1330, discount: 10, featured: true, ru: 'Для активных авторов, Reels, изображений и ежедневной работы.', en: 'For active creators, Reels, images and everyday work.' },
  { name: 'Professional', price: 4990, tokens: 2350, discount: 15, ru: 'Максимальный пакет для профессиональной и коммерческой работы.', en: 'Maximum value for professional and commercial use.' },
] as const

const packs = [
  { tokens: 200, price: 500 },
  { tokens: 500, price: 1250 },
  { tokens: 1000, price: 2500 },
  { tokens: 2000, price: 5000 },
] as const

export function SitePricing() {
  const { locale } = useSiteLocale()
  const ru = locale === 'ru'

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:px-8">
      <div className="rounded-[2rem] bg-[#0B0F1A] px-6 py-10 text-white md:px-10 md:py-12">
        <p className="text-xs font-bold tracking-[0.16em] text-[#F6AB10]">{ru ? 'ТАРИФЫ' : 'PRICING'}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">{ru ? 'Понятные тарифы и Tokens' : 'Simple plans and Tokens'}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#A8B3C7]">
          {ru
            ? 'Можно пользоваться без тарифа и покупать Tokens отдельно. Тарифы действуют 30 дней, включают Tokens и дают скидку на пополнение баланса.'
            : 'Use Banana Zero without a plan and buy Tokens separately, or choose a 30-day plan with included Tokens and a top-up discount.'}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-3xl border p-5 ${plan.featured ? 'border-[#F6AB10]/60 bg-white/[0.09]' : 'border-white/10 bg-white/[0.05]'}`}>
              {plan.featured && <span className="absolute right-4 top-4 rounded-full bg-[#F6AB10] px-2.5 py-1 text-[10px] font-black text-[#171A22]">{ru ? 'ПОПУЛЯРНЫЙ' : 'POPULAR'}</span>}
              <p className="text-lg font-bold">{plan.name}</p>
              <p className="mt-2 text-3xl font-black">{plan.price.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽<span className="text-sm font-medium text-[#8F9DB3]"> / 30 {ru ? 'дней' : 'days'}</span></p>
              <p className="mt-4 text-sm leading-6 text-[#C3CDDC]">{ru ? plan.ru : plan.en}</p>
              <div className="mt-5 space-y-2 text-sm">
                <p><strong>{plan.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens</strong> {ru ? 'включено' : 'included'}</p>
                <p>{ru ? 'Скидка на пополнение:' : 'Top-up discount:'} <strong>{plan.discount}%</strong></p>
                <p className="text-[#8F9DB3]">{ru ? 'Все инструменты и модели видны сразу' : 'All tools and models remain visible'}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-base font-bold">{ru ? 'Без тарифа — разовая покупка Tokens' : 'No plan — one-time Token purchase'}</p>
              <p className="mt-1 text-xs text-[#8F9DB3]">{ru ? 'Tokens — внутренняя единица Banana Zero. Тариф не требуется. Купленные отдельно Tokens не сгорают, пока аккаунт активен.' : 'Tokens are internal Banana Zero usage units. No plan required. Separately purchased Tokens do not expire while the account is active.'}</p>
            </div>
            <Link href="/pay" className="rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[#171A22]">{ru ? 'Купить Tokens' : 'Buy Tokens'}</Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {packs.map((pack) => (
              <div key={pack.tokens} className="rounded-2xl bg-black/20 px-4 py-3">
                <p className="text-sm font-bold">{pack.tokens.toLocaleString(ru ? 'ru-RU' : 'en-US')} Tokens</p>
                <p className="mt-1 text-lg font-black">{pack.price.toLocaleString(ru ? 'ru-RU' : 'en-US')} ₽</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#8F9DB3]">
          {ru
            ? 'Стоимость каждой генерации показывается в Tokens до запуска. Tokens тарифа действуют до окончания оплаченного 30-дневного периода; Tokens, купленные отдельно, не сгорают при активном аккаунте.'
            : 'Each generation shows its Token price before launch. Plan Tokens are valid through the paid 30-day period; separately purchased Tokens do not expire while the account remains active.'}
        </p>
      </div>
    </section>
  )
}
