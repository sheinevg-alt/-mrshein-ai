import Image from 'next/image'
import Link from 'next/link'
import { MERCHANT } from '@/lib/merchant'

type Section = {
  title: string
  paragraphs: string[]
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  showMerchantDetails = false,
}: {
  eyebrow: string
  title: string
  intro: string
  sections: Section[]
  showMerchantDetails?: boolean
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFF] text-[#171A22]">
      <header className="border-b border-[#E6EEFF] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="https://bananazero.ru" className="flex items-center gap-3">
            <span className="relative size-10 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
              <Image src="/banana-zero-cake.jpg" alt="Banana Zero" fill sizes="40px" className="object-cover" />
            </span>
            <span className="font-bold">Banana <span className="text-[#1E3A8A]">Zero</span></span>
          </Link>
          <Link href="https://bananazero.ru" className="rounded-full bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white">
            На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[#66758E]">{intro}</p>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-[#E6EEFF] bg-white p-6 md:p-7">
              <h2 className="text-lg font-bold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#55657D]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>

        {showMerchantDetails && (
          <div className="mt-10 rounded-3xl bg-[#0B0F1A] p-6 text-white">
            <p className="text-sm font-semibold">Реквизиты Исполнителя</p>
            <dl className="mt-4 grid gap-3 text-sm leading-6 text-[#D7DEEA] sm:grid-cols-[150px_1fr]">
              <dt className="text-[#8F9DB3]">Исполнитель</dt><dd>{MERCHANT.legalName}</dd>
              <dt className="text-[#8F9DB3]">ИНН</dt><dd>{MERCHANT.inn}</dd>
              <dt className="text-[#8F9DB3]">ОГРНИП</dt><dd>{MERCHANT.ogrnip}</dd>
              <dt className="text-[#8F9DB3]">Адрес</dt><dd>{MERCHANT.address}</dd>
              <dt className="text-[#8F9DB3]">Банк</dt><dd>{MERCHANT.bankName}</dd>
              <dt className="text-[#8F9DB3]">Расчётный счёт</dt><dd>{MERCHANT.settlementAccount}</dd>
              <dt className="text-[#8F9DB3]">БИК</dt><dd>{MERCHANT.bik}</dd>
              <dt className="text-[#8F9DB3]">Корр. счёт</dt><dd>{MERCHANT.correspondentAccount}</dd>
              <dt className="text-[#8F9DB3]">Сайт</dt><dd>bananazero.ru</dd>
              <dt className="text-[#8F9DB3]">Поддержка</dt><dd>{MERCHANT.telegramLabel}</dd>
            </dl>
          </div>
        )}
      </main>

      <footer className="border-t border-[#E6EEFF] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-x-5 gap-y-2 px-5 py-7 text-xs text-[#66758E] md:px-8">
          <Link href="/privacy">Политика конфиденциальности</Link>
          <Link href="/offer">Публичная оферта</Link>
          <Link href="/refund">Оплата и возврат</Link>
          <Link href="/contacts">Контакты</Link>
        </div>
      </footer>
    </div>
  )
}
