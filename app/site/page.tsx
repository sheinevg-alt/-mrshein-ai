'use client'

import Link from 'next/link'
import { ArrowRight, Clapperboard, ImageIcon, MessageSquareText, Music2, Sparkles, WandSparkles } from 'lucide-react'
import { MERCHANT } from '@/lib/merchant'
import { SiteHeader } from '@/components/site/site-header'
import { SiteTrendHits } from '@/components/site/site-trend-hits'
import { SitePricing } from '@/components/site/site-pricing'
import { useSiteLocale } from '@/components/site/site-locale-provider'

const copy = {
  ru: {
    badge: 'BANANA ZERO · AI CREATIVE PLATFORM',
    hero1: 'Создавайте сразу.',
    hero2: 'Без долгих настроек.',
    heroText: 'Тренды, видео, изображения, аудио и AI-текст — выберите нужное действие и переходите прямо к созданию.',
    seeTrends: 'Смотреть тренды',
    how: 'Как это работает',
    opportunities: 'ВОЗМОЖНОСТИ',
    allInOne: 'Всё нужное — в одном месте',
    allInOneText: 'Для быстрого старта используйте тренды и готовые инструменты. Для сложных задач откройте профессиональные AI-модели.',
    howLabel: 'КАК ЭТО РАБОТАЕТ',
    threeSteps: 'Три шага до результата',
    pricing: 'ТАРИФЫ',
    pricingTitle: 'Понятные тарифы и Tokens',
    pricingText: 'Можно пользоваться без тарифа и покупать Tokens отдельно. Тарифы действуют 30 дней, включают Tokens и дают скидку на пополнение баланса.',
    openCreate: 'Открыть создание',
    privacy: 'Политика конфиденциальности',
    offer: 'Публичная оферта',
    refund: 'Оплата и возврат',
    contacts: 'Контакты',
  },
  en: {
    badge: 'BANANA ZERO · AI CREATIVE PLATFORM',
    hero1: 'Create right away.',
    hero2: 'No complicated setup.',
    heroText: 'Trends, video, images, audio and AI text — choose what you need and start creating immediately.',
    seeTrends: 'Explore trends',
    how: 'How it works',
    opportunities: 'CAPABILITIES',
    allInOne: 'Everything you need in one place',
    allInOneText: 'Use trends and ready-made tools for a quick start. Open professional AI models when you need more control.',
    howLabel: 'HOW IT WORKS',
    threeSteps: 'Three steps to your result',
    pricing: 'PRICING',
    pricingTitle: 'Simple plans and Tokens',
    pricingText: 'Use Banana Zero without a plan and buy Tokens separately, or choose a 30-day plan with included Tokens and a top-up discount.',
    openCreate: 'Start creating',
    privacy: 'Privacy Policy',
    offer: 'Public Offer',
    refund: 'Payments & Refunds',
    contacts: 'Contacts',
  },
} as const

const quickActions = [
  { ru: ['Тренды', 'Готовые хиты'], en: ['Trends', 'Ready-to-use hits'], href: '/app?tab=trends', icon: Sparkles, accent: true },
  { ru: ['Видео', 'Создать видео'], en: ['Video', 'Create video'], href: '/app?tab=create&category=video', icon: Clapperboard },
  { ru: ['Изображения', 'Создать фото'], en: ['Images', 'Create images'], href: '/app?tab=create&category=image', icon: ImageIcon },
  { ru: ['Аудио', 'Музыка и голос'], en: ['Audio', 'Music and voice'], href: '/app?tab=create&category=audio', icon: Music2 },
  { ru: ['Текст', 'AI-ассистент'], en: ['Text', 'AI assistant'], href: '/app?tab=create&category=text', icon: MessageSquareText },
] as const

const features = [
  {
    icon: Clapperboard,
    ru: ['AI-видео', 'Создание видео по промпту и референсам без перегруженного интерфейса.'],
    en: ['AI Video', 'Create video from prompts and references without a cluttered interface.'],
  },
  {
    icon: ImageIcon,
    ru: ['AI-изображения', 'Генерация и редактирование изображений в одном месте.'],
    en: ['AI Images', 'Generate and edit images in one place.'],
  },
  {
    icon: Sparkles,
    ru: ['Готовые тренды', 'Выберите готовый сценарий, загрузите свои материалы и получите результат.'],
    en: ['Ready Trends', 'Choose a ready-made scenario, upload your media and get a result.'],
  },
  {
    icon: WandSparkles,
    ru: ['Профессиональные модели', 'Seedance, Omni Flash, Kling, Nano Banana, GPT Image и другие модели доступны напрямую.'],
    en: ['Professional Models', 'Seedance, Omni Flash, Kling, Nano Banana, GPT Image and other models are available directly.'],
  },
] as const

const steps = [
  { n: '01', ru: ['Выберите', 'Тренд или нужный AI-инструмент.'], en: ['Choose', 'A trend or the AI tool you need.'] },
  { n: '02', ru: ['Загрузите', 'Добавьте только нужные фото, видео или референсы.'], en: ['Upload', 'Add only the photos, videos or references you need.'] },
  { n: '03', ru: ['Создайте', 'Запустите генерацию и получите результат в «Моих работах».'], en: ['Create', 'Run the generation and find the result in My Works.'] },
] as const

export default function SitePage() {
  const { locale } = useSiteLocale()
  const t = copy[locale]

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
                {t.badge}
              </span>
              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-[-0.045em] md:text-7xl">
                {t.hero1}<br />
                <span className="text-[#1E3A8A]">{t.hero2}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#66758E] md:text-lg">{t.heroText}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#trends" className="inline-flex items-center gap-2 rounded-full bg-[#1E3A8A] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-16px_rgba(30,58,138,0.85)]">
                  {t.seeTrends} <ArrowRight className="size-4" />
                </a>
                <a href="#how" className="rounded-full border border-[#CBD5F3] bg-white px-6 py-3.5 text-sm font-semibold text-[#334155]">
                  {t.how}
                </a>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {quickActions.map(({ ru, en, href, icon: Icon, accent }) => {
                const [title, hint] = locale === 'ru' ? ru : en
                return (
                  <Link
                    key={href}
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
                )
              })}
            </div>
          </div>
        </section>

        <SiteTrendHits />

        <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">{t.opportunities}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{t.allInOne}</h2>
            <p className="mt-3 text-sm leading-6 text-[#66758E]">{t.allInOneText}</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, ru, en }, index) => {
              const [title, text] = locale === 'ru' ? ru : en
              return (
                <article key={title} className="rounded-3xl border border-[#E6EEFF] bg-white p-6 shadow-[0_18px_45px_-32px_rgba(30,58,138,0.3)]">
                  <span className={`flex size-11 items-center justify-center rounded-2xl ${index === 2 ? 'bg-[#FFF3D6] text-[#B66E00]' : 'bg-[#E0E7FF] text-[#1E3A8A]'}`}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66758E]">{text}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="how" className="border-y border-[#E6EEFF] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
            <p className="text-xs font-bold tracking-[0.16em] text-[#1E3A8A]">{t.howLabel}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{t.threeSteps}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((step) => {
                const [title, text] = locale === 'ru' ? step.ru : step.en
                return (
                  <div key={step.n} className="rounded-3xl bg-[#F8FAFF] p-6">
                    <span className="text-sm font-black text-[#F6AB10]">{step.n}</span>
                    <h3 className="mt-5 text-xl font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#66758E]">{text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <SitePricing />
      </main>

      <footer className="border-t border-[#E6EEFF] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[#66758E] md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <div className="flex items-center gap-2"><span className="font-bold text-[#171A22]">Banana Zero</span><span>·</span><span>bananazero.ru</span></div>
            <p className="mt-1 text-[11px] text-[#8B99AD]">{MERCHANT.legalName} · {locale === 'ru' ? 'ИНН' : 'TIN'} {MERCHANT.inn} · {locale === 'ru' ? 'ОГРНИП' : 'Registration'} {MERCHANT.ogrnip}</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy" className="transition hover:text-[#171A22]">{t.privacy}</Link>
            <Link href="/offer" className="transition hover:text-[#171A22]">{t.offer}</Link>
            <Link href="/refund" className="transition hover:text-[#171A22]">{t.refund}</Link>
            <Link href="/contacts" className="transition hover:text-[#171A22]">{t.contacts}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
