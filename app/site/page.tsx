import Link from 'next/link'
import { ArrowRight, Clapperboard, ImageIcon, MessageSquareText, Music2, Sparkles, WandSparkles } from 'lucide-react'
import { MERCHANT } from '@/lib/merchant'
import { SiteHeader } from '@/components/site/site-header'
import { SiteTrendHits } from '@/components/site/site-trend-hits'

const quickActions = [
  { title: 'Тренды', hint: 'Готовые хиты', href: '/app?tab=trends', icon: Sparkles, accent: true },
  { title: 'Видео', hint: 'Создать видео', href: '/app?tab=create&category=video', icon: Clapperboard },
  { title: 'Изображения', hint: 'Создать фото', href: '/app?tab=create&category=image', icon: ImageIcon },
  { title: 'Аудио', hint: 'Музыка и голос', href: '/app?tab=create&category=audio', icon: Music2 },
  { title: 'Чат', hint: 'AI-ассистент', href: '/app?tab=create&category=text', icon: MessageSquareText },
]

const features = [
  { icon: Clapperboard, title: 'AI-видео', text: 'Создание видео по промпту и референсам без перегруженного интерфейса.' },
  { icon: ImageIcon, title: 'AI-изображения', text: 'Генерация и редактирование изображений в одном месте.' },
  { icon: Sparkles, title: 'Готовые тренды', text: 'Выберите готовый сценарий, загрузите свои фото и получите результат.' },
  { icon: WandSparkles, title: 'Профессиональный режим', text: 'Больше настроек, когда нужен полный контроль над генерацией.' },
]

const steps = [
  ['01', 'Выберите', 'Тренд или нужный инструмент.'],
  ['02', 'Загрузите', 'Добавьте только те фото, видео или референсы, которые нужны.'],
  ['03', 'Создайте', 'Запустите генерацию и получите результат в «Моих работах».'],
]

export default function SitePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] text-[#171A22] selection:bg-[#F6AB10]/25">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-0 h-[640px] bg-[radial-gradient(circle_at_50%_0%,#DDE9FF_0%,transparent_68%)]" />
          <div className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pb-14 md:pt-20">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#CBD5F3] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#1E3A8A] shadow-sm">
                <span className="size-2 rounded-full bg-[#F6AB10]" />
                BANANA ZERO · AI CREATION
              </span>
              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.045em] md:text-7xl">
                Создавайте сразу.<br />
                <span className="text-[#1E3A8A]">Без долгих настроек.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#66758E] md:text-lg">
                Тренды, видео, изображения, аудио и AI-чат — выберите нужное действие и переходите прямо к созданию.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#trends" className="inline-flex items-center gap-2 rounded-full bg-[#1E3A8A] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-16px_rgba(30,58,138,0.85)]">
                  Смотреть тренды <ArrowRight className="size-4" />
                </a>
                <a href="#how" className="rounded-full border border-[#CBD5F3] bg-white px-6 py-3.5 text-sm font-semibold text-[#334155]">
                  Как это работает
                </a>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {quickActions.map(({ title, hint, href, icon: Icon, accent }) => (
                <Link
                  key={title}
                  href={href}
                  className={`group rounded-3xl border p-4 transition active:scale-[0.98] ${accent ? 'border-[#F6AB10]/35 bg-[#FFF8E8]' : 'border-[#E6EEFF] bg-white'}`}
                >
                  <span className={`flex size-10 items-center justify-center rounded-2xl ${accent ? 'bg-[#F6AB10] text-[#171A22]' : 'bg-[#E0E7FF] text-[#1E3A8A]'}`}>
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-5 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-[#7B899D]">{hint}</p>
                  <ArrowRight className="mt-4 size-4 text-[#9AA6B8] transition group-hover:translate-x-1 group-hover:text-[#1E3A8A]" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <SiteTrendHits />

        <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">ВОЗМОЖНОСТИ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Всё нужное — в одном месте</h2>
            <p className="mt-3 text-sm leading-6 text-[#66758E]">Для быстрого старта используйте тренды и готовые инструменты. Для сложных задач откройте профессиональный режим.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">КАК ЭТО РАБОТАЕТ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Три шага до результата</h2>
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

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="rounded-[2rem] bg-[#0B0F1A] px-6 py-10 text-white md:px-10 md:py-12">
            <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-[#F6AB10]">ТАРИФЫ</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight">Оплачивайте только нужные генерации</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8B3C7]">Пакеты токенов и рублёвая оплата будут доступны после подключения интернет-эквайринга.</p>
              </div>
              <Link href="/app?tab=create" className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white">
                Открыть создание
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6EEFF] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[#66758E] md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <div className="flex items-center gap-2"><span className="font-bold text-[#171A22]">Banana Zero</span><span>·</span><span>bananazero.ru</span></div>
            <p className="mt-1 text-[11px] text-[#8B99AD]">{MERCHANT.legalName} · ИНН {MERCHANT.inn} · ОГРНИП {MERCHANT.ogrnip}</p>
          </div>
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
