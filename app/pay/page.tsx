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
          <Image src="/mrshein-ai-logo.png" alt="Shein AI" width={44} height={44} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Shein AI</h1>
            <p className="text-sm text-muted-foreground">Пополнение баланса в рублях</p>
          </div>
        </header>

        <section className="glass mt-8 rounded-4xl p-5 sm:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Web checkout</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Оплата российскими картами и через СБП</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Рублёвая оплата работает на сайте. Внутри Telegram цифровые услуги оплачиваются по правилам Telegram.</p>
          </div>
          <div className="mt-7"><PaymentForm enabled={enabled} /></div>
        </section>

        <footer className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/legal/offer" className="underline underline-offset-4">Оферта</Link>
          <Link href="/legal/privacy" className="underline underline-offset-4">Конфиденциальность</Link>
          <Link href="/legal/refunds" className="underline underline-offset-4">Возвраты</Link>
          <Link href="/legal/contacts-and-requisites" className="underline underline-offset-4">Контакты и реквизиты</Link>
          <Link href="/legal/service-delivery" className="underline underline-offset-4">Порядок оказания услуг</Link>
        </footer>
      </div>
    </main>
  )
}
