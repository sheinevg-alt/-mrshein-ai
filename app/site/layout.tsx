import type { Metadata } from 'next'
import { SiteLocaleProvider } from '@/components/site/site-locale-provider'

export const metadata: Metadata = {
  title: 'Banana Zero — AI Creative Platform',
  description: 'Banana Zero — AI Creative Platform для видео, изображений, текста и аудио. Готовые тренды и профессиональные AI-инструменты в одном интерфейсе.',
  alternates: {
    canonical: 'https://bananazero.ru',
  },
  openGraph: {
    title: 'Banana Zero',
    description: 'Создавайте видео, изображения, текст и аудио с AI — тренды и профессиональные инструменты в одном месте.',
    url: 'https://bananazero.ru',
    siteName: 'Banana Zero',
    type: 'website',
  },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteLocaleProvider>{children}</SiteLocaleProvider>
}
