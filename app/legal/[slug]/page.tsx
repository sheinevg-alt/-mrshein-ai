import { notFound } from 'next/navigation'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

const allowed = new Set(['offer','privacy','refunds','contacts-and-requisites','service-delivery'])

export const dynamic = 'force-dynamic'

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!allowed.has(slug)) notFound()

  let page: any = null
  if (hasDatabase()) {
    const response = await supabaseFetch(`legal_pages?select=slug,title_ru,body_ru,published&slug=eq.${encodeURIComponent(slug)}&limit=1`)
    if (response.ok) page = (await response.json())?.[0] || null
  }

  const title = page?.title_ru || 'Юридическая информация'
  const body = String(page?.body_ru || '').trim()

  return (
    <main className="min-h-dvh px-4 py-10">
      <article className="glass mx-auto max-w-3xl rounded-4xl p-6 sm:p-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        {page?.published && body ? (
          <div data-selectable className="mt-6 whitespace-pre-wrap text-sm leading-7">{body}</div>
        ) : (
          <div className="mt-6 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Страница подготовлена технически, но юридический текст ещё не опубликован.</div>
        )}
      </article>
    </main>
  )
}
