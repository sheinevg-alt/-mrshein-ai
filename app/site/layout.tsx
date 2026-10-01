import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Banana Zero — AI-видео, изображения и готовые тренды',
  description: 'Banana Zero — сервис для создания AI-видео и изображений. Готовые тренды, генерация по референсам и профессиональные инструменты в одном интерфейсе.',
  alternates: {
    canonical: 'https://bananazero.ru',
  },
  openGraph: {
    title: 'Banana Zero',
    description: 'Создавайте AI-видео и изображения без лишней сложности.',
    url: 'https://bananazero.ru',
    siteName: 'Banana Zero',
    type: 'website',
  },
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children
}
