import Image from 'next/image'
import Link from 'next/link'

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] text-[#171A22]">
      <header className="border-b border-[#E6EEFF] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="https://bananazero.ru" className="flex items-center gap-3">
            <span className="relative size-10 overflow-hidden rounded-full ring-1 ring-black/5">
              <Image src="/banana-zero-cake.jpg" alt="Banana Zero" fill sizes="40px" className="object-cover" />
            </span>
            <span className="font-bold">Banana <span className="text-[#1E3A8A]">Zero</span></span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-14 md:px-8">
        <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">КОНТАКТЫ</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">Связаться с Banana Zero</h1>
        <p className="mt-5 max-w-2xl leading-7 text-[#66758E]">Вопросы по оплате, генерациям, аккаунту и работе сервиса можно направить в службу поддержки.</p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <a href="https://t.me/MrShein_AI" className="rounded-3xl border border-[#E6EEFF] bg-white p-6 transition hover:border-[#CBD5F3]">
            <p className="text-xs font-bold text-[#1E3A8A]">TELEGRAM</p>
            <p className="mt-3 text-lg font-bold">@MrShein_AI</p>
            <p className="mt-2 text-sm text-[#66758E]">Поддержка пользователей Banana Zero.</p>
          </a>
          <div className="rounded-3xl border border-[#E6EEFF] bg-white p-6">
            <p className="text-xs font-bold text-[#1E3A8A]">E-MAIL</p>
            <p className="mt-3 text-lg font-bold">Будет добавлен</p>
            <p className="mt-2 text-sm text-[#66758E]">Отдельный e-mail поддержки подключим перед запуском оплаты.</p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-[#0B0F1A] p-6 text-white">
          <p className="font-bold">Реквизиты продавца</p>
          <p className="mt-2 text-sm leading-6 text-[#A8B3C7]">Для подачи на эквайринг сюда нужно добавить точное наименование ИП, ИНН, ОГРНИП, адрес и контактный e-mail. Эти данные не будут придумываться и будут внесены после подтверждения владельцем.</p>
        </div>
      </main>
    </div>
  )
}
