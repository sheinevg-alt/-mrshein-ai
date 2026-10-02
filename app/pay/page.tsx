import Link from 'next/link'
import Image from 'next/image'
import { PUBLIC_PLANS, PUBLIC_TOKEN_PACKS } from '@/lib/public-pricing'
import { PaymentForm } from './payment-form'

export const dynamic = 'force-dynamic'

export default async function PayPage({ searchParams }: { searchParams: Promise<{ tokens?: string }> }) {
  const enabled = process.env.NEXT_PUBLIC_RUBLE_CHECKOUT_ENABLED === 'true'
  const params = await searchParams
  const requestedTokens = Number(params?.tokens || 500)
  const initialTokens = PUBLIC_TOKEN_PACKS.some((item) => item.tokens === requestedTokens) ? requestedTokens : 500

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-3">
          <Image src="/banana-zero-cake.jpg" alt="Banana Zero" width={44} height={44} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Banana Zero</h1>
            <p className="text-sm text-muted-foreground">Тарифы и покупка Tokens</p>
          </div>
        </header>

        <section className="glass mt-8 rounded-4xl p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Стоимость цифровых услуг</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Тарифы Banana Zero</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Цена на карточке уже включает указанную скидку. Дополнительная скидка после покупки тарифа не подразумевается.</p>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {PUBLIC_PLANS.map((plan) => (
              <article key={plan.code} className="relative rounded-3xl border bg-card p-4">
                <span className="absolute right-3 top-3 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700">−{plan.discountPct}%</span>
                <p className="text-base font-bold">{plan.name}</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <span className="text-xs text-muted-foreground line-through">{plan.regularRub.toLocaleString('ru-RU')} ₽</span>
                  <span className="text-2xl font-black">{plan.priceRub.toLocaleString('ru-RU')} ₽</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">на 30 дней</p>
                <p className="mt-4 text-sm font-semibold">{plan.tokens.toLocaleString('ru-RU')} Tokens включено</p>
                <p className="mt-1 text-xs text-brand">Скидка уже учтена в цене</p>
              </article>
            ))}
          </div>

          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Процент округлён до целого значения относительно обычной стоимости такого объёма Tokens. Подключение тарифа станет доступно после активации интернет-эквайринга.
          </p>

          <div className="mt-8 border-t pt-7"><PaymentForm enabled={enabled} initialTokens={initialTokens} /></div>
        </section>

        <footer className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4">Тарифы</Link>
          <Link href="/offer" className="underline underline-offset-4">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4">Конфиденциальность</Link>
          <Link href="/refund" className="underline underline-offset-4">Возвраты</Link>
          <Link href="/contacts" className="underline underline-offset-4">Контакты и реквизиты</Link>
        </footer>
      </div>
    </main>
  )
}
