import Link from 'next/link'

const pages = [
  ['offer', 'Публичная оферта'],
  ['privacy', 'Политика конфиденциальности'],
  ['refunds', 'Условия возврата'],
  ['contacts-and-requisites', 'Контакты'],
  ['service-delivery', 'Порядок оказания услуг и получения результата'],
]

export default function LegalIndexPage() {
  return (
    <main className="min-h-dvh px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Юридическая информация Banana Zero</h1>
        <div className="mt-6 space-y-3">
          {pages.map(([slug, title]) => <Link key={slug} href={`/legal/${slug}`} className="glass block rounded-2xl p-4 font-medium">{title}</Link>)}
        </div>
      </div>
    </main>
  )
}
