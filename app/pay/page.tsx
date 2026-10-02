import Link from 'next/link'
import Image from 'next/image'
import { PaymentForm } from './payment-form'

export const dynamic = 'force-dynamic'

export default function PayPage() {
  const enabled = process.env.NEXT_PUBLIC_RUBLE_CHECKOUT_ENABLED === 'true'

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-3">
          <Image src="/banana-zero-cake.jpg" alt="Banana Zero" width={44} height={44} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Banana Zero</h1>
            <p className="text-sm text-muted-foreground">Пополнение баланса в рублях</p>
          </div>
        </header>

        <section className="glass mt-8 rounded-4xl p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Web checkout</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Оплата российскими картами и через СБП</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Выберите пакет Tokens. Стоимость фиксирована и указана до оплаты. Оплата будет доступна после подключения интернет-эквайринга.</p>
          </div>
          <div className="mt-7">
            <p className="text-sm font-semibold">Тарифы на 30 дней</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                { name: 'Beginner', price: 1490, tokens: 630, discount: 5 },
                { name: 'Creator', price: 2990, tokens: 1330, discount: 10 },
                { name: 'Professional', price: 4990, tokens: 2350, discount: 15 },
              ].map((plan) => (
                <article key={plan.name} className="rounded-3xl border bg-card p-4">
                  <p className="text-base font-bold">{plan.name}</p>
                  <p className="mt-2 text-2xl font-black">{plan.price.toLocaleString('ru-RU')} ₽</p>
                  <p className="mt-1 text-xs text-muted-foreground">на 30 дней</p>
                  <p className="mt-4 text-sm font-semibold">{plan.tokens.toLocaleString('ru-RU')} Tokens включено</p>
                  <p className="mt-1 text-xs text-brand">Скидка {plan.discount}% на пополнение</p>
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Подключение тарифа станет доступно после активации интернет-эквайринга. Разовые пакеты Tokens можно выбрать ниже.
            </p>
          </div>

          <div className="mt-8 border-t pt-7"><PaymentForm enabled={enabled} /></div>
        </section>

        <footer className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/offer" className="underline underline-offset-4">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4">Конфиденциальность</Link>
          <Link href="/refund" className="underline underline-offset-4">Возвраты</Link>
          <Link href="/contacts" className="underline underline-offset-4">Контакты и реквизиты</Link>
          <Link href="/offer" className="underline underline-offset-4">Порядок оказания услуг</Link>
        </footer>
      </div>
    </main>
  )
}
