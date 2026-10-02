import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ announcements: [] })
  const now = new Date().toISOString()
  const response = await supabaseFetch(
    `announcements?select=id,kind,title_ru,title_en,body_ru,body_en,link_url,published_at,expires_at&is_published=eq.true&published_at=not.is.null&published_at=lte.${encodeURIComponent(now)}&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(now)})&order=published_at.desc&limit=20`,
  )
  const announcements = response.ok ? await response.json() : []
  return NextResponse.json({ announcements }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } })
}
