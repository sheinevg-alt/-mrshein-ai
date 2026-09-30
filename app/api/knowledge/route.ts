import { NextResponse } from 'next/server'
import { fallbackKnowledgeArticles } from '@/lib/knowledge'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ articles: fallbackKnowledgeArticles })

  const response = await supabaseFetch(
    'knowledge_articles?select=id,slug,category,title_en,title_ru,body_en,body_ru,sort_order&published=eq.true&order=sort_order.asc,created_at.asc',
  )
  if (!response.ok) return NextResponse.json({ articles: fallbackKnowledgeArticles })
  const rows = await response.json()
  const articles = rows.map((row: any) => ({
    id: String(row.id),
    slug: String(row.slug),
    category: row.category,
    title: { en: row.title_en, ru: row.title_ru || undefined },
    body: { en: row.body_en, ru: row.body_ru || undefined },
    sortOrder: Number(row.sort_order || 100),
  }))
  return NextResponse.json({ articles: articles.length ? articles : fallbackKnowledgeArticles })
}
