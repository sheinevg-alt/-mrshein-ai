import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clapperboard, ImageIcon, Sparkles, WandSparkles } from 'lucide-react'

const features = [
  { icon: Clapperboard, title: 'AI-видео', text: 'Создавайте видео по промпту и референсам в несколько шагов.' },
  { icon: ImageIcon, title: 'AI-изображения', text: 'Генерация и редактирование изображений в одном интерфейсе.' },
  { icon: Sparkles, title: 'Готовые тренды', text: 'Выберите тренд, загрузите свои фото и получите готовый результат.' },
  { icon: WandSparkles, title: 'Профессиональный режим', text: 'Больше настроек для тех, кому нужен полный контроль над генерацией.' },
]

const steps = [
  ['01', 'Выберите', 'Тренд или инструмент под вашу задачу.'],
  ['02', 'Загрузите', 'Фото, видео или референсы — только то, что действительно нужно.'],
  ['03', 'Создайте', 'Запустите генерацию и получите результат в «Моих работах».'],
]

export default function SitePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] text-[#171A22] selection:bg-[#F6AB10]/25">
      <header className="sticky top-0 z-30 border-b border-[#E6EEFF]/80 bg-[#F8FAFF]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 md:px-8">
          <Link href="/site" className="flex items-center gap-3">
            <span className="relative size-11 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
              <Image src="/banana-zero-cake.jpg" alt="Banana Zero" fill sizes="44px" className="object-cover" priority />
            </span>
            <span className="text-lg font-bold tracking-tight">Banana <span className="text-[#1E3A8A]">Zero</span></span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-[#66758E] md:flex">
            <a href="#features" className="transition hover:text-[#171A22]">Возможности</a>
            <a href="#how" className="transition hover:text-[#171A22]">Как работает</a>
            <a href="#pricing" className="transition hover:text-[#171A22]">Тарифы</a>
            <Link href="/contacts" className="transition hover:text-[#171A22]">Контакты</Link>
          </nav>
          <a
            href="https://mrshein-ai-v3.vercel.app"
            className="rounded-full bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(30,58,138,0.75)] transition hover:bg-[#173276]"
          >
            Открыть приложение
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_50%_0%,#DDE9FF_0%,transparent_68%)]" />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:px-8 md:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#CBD5F3] bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] shadow-sm">
                <span className="size-2 rounded-full bg-[#F6AB10]" />
                AI CREATION PLATFORM
              </span>
              <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] md:text-7xl">
                Создавайте с AI.<br />
                <span className="text-[#1E3A8A]">Без лишней сложности.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#66758E] md:text-lg">
                Видео, изображения и готовые тренды в одном сервисе. Banana Zero прячет сложные настройки и оставляет только то, что нужно для результата.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="https://mrshein-ai-v3.vercel.app" className="inline-flex items-center gap-2 rounded-full bg-[#1E3A8A] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-16px_rgba(30,58,138,0.85)]">
                  Попробовать Banana Zero <ArrowRight className="size-4" />
                </a>
                <a href="#how" className="rounded-full border border-[#CBD5F3] bg-white px-6 py-3.5 text-sm font-semibold text-[#334155]">
                  Как это работает
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[#3B82F6]/10 blur-3xl" />
              <div className="rounded-[2.2rem] border border-white bg-white/92 p-3 shadow-[0_35px_80px_-35px_rgba(30,58,138,0.35)] backdrop-blur">
                <div className="rounded-[1.7rem] bg-[#F4F7FF] p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="relative size-12 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                        <Image src="/banana-zero-cake.jpg" alt="" fill sizes="48px" className="object-cover" />
                      </span>
                      <div><p className="font-bold">Banana Zero</p><p className="text-xs text-[#66758E]">AI creator</p></div>
                    </div>
                    <span className="rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[10px] font-bold text-[#8B5C00]">NEW</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {['Видео по тренду', 'Фото → Видео', 'Генерация фото', 'Профессионально'].map((item, i) => (
                      <div key={item} className="rounded-2xl border border-[#E6EEFF] bg-white p-4 shadow-sm">
                        <div className={`mb-8 size-9 rounded-xl ${i === 0 ? 'bg-[#FFF3D6]' : 'bg-[#E0E7FF]'}`} />
                        <p className="text-sm font-semibold">{item}</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 w-full rounded-2xl bg-[#1E3A8A] py-3.5 text-sm font-semibold text-white">Создать</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-20 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">ВОЗМОЖНОСТИ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Один интерфейс для разных AI-задач</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="rounded-3xl border border-[#E6EEFF] bg-white p-6 shadow-[0_18px_45px_-32px_rgba(30,58,138,0.3)]">
                <span className={`flex size-11 items-center justify-center rounded-2xl ${index === 2 ? 'bg-[#FFF3D6] text-[#B66E00]' : 'bg-[#E0E7FF] text-[#1E3A8A]'}`}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66758E]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-[#E6EEFF] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">КАК ЭТО РАБОТАЕТ</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map(([n, title, text]) => (
                <div key={n} className="rounded-3xl bg-[#F8FAFF] p-6">
                  <span className="text-sm font-black text-[#F6AB10]">{n}</span>
                  <h3 className="mt-5 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66758E]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 md:px-8">
          <div className="rounded-[2rem] bg-[#0B0F1A] px-6 py-10 text-white md:px-10 md:py-12">
            <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[#F6AB10]">ТАРИФЫ</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">Оплачивайте только нужные генерации</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8B3C7]">Пакеты токенов и рублёвая оплата появятся здесь после подключения эквайринга.</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-[#D7DEEA]">Скоро</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6EEFF] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[#66758E] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-2"><span className="font-bold text-[#171A22]">Banana Zero</span><span>·</span><span>bananazero.ru</span></div>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="transition hover:text-[#171A22]">Политика конфиденциальности</Link>
            <Link href="/offer" className="transition hover:text-[#171A22]">Публичная оферта</Link>
            <Link href="/refund" className="transition hover:text-[#171A22]">Оплата и возврат</Link>
            <Link href="/contacts" className="transition hover:text-[#171A22]">Контакты</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
