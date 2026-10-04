import { NextResponse } from 'next/server'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { quoteTrendTokens } from '@/lib/server/trend-pricing'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(request.url)
  const trendId = String(url.searchParams.get('trendId') || '')
  const requestedResolution = String(url.searchParams.get('resolution') || '').toLowerCase()
  if (!trendId) return NextResponse.json({ error: 'TREND_ID_REQUIRED' }, { status: 400 })

  const response = await supabaseFetch(
    `trends?select=id,token_cost,provider,model,duration_seconds,generation_config,published&id=eq.${encodeURIComponent(trendId)}&limit=1`,
  )
  const rows = response.ok ? await response.json() : []
  const trend = rows?.[0]
  if (!trend?.published) return NextResponse.json({ error: 'Trend not found' }, { status: 404 })

  const config = trend.generation_config && typeof trend.generation_config === 'object'
    ? trend.generation_config as Record<string, unknown>
    : {}
  const allowed = Array.isArray(config.allowed_resolutions)
    ? config.allowed_resolutions.map((value: unknown) => String(value).toLowerCase())
    : []
  const fallbackResolution = String(config.default_resolution || allowed[0] || '480p').toLowerCase()
  const resolution = requestedResolution && (!allowed.length || allowed.includes(requestedResolution))
    ? requestedResolution
    : fallbackResolution

  const quote = await quoteTrendTokens({
    provider: trend.provider,
    model: trend.model,
    durationSeconds: trend.duration_seconds,
    resolution,
    configuredTokenCost: trend.token_cost,
  })

  return NextResponse.json({
    ok: true,
    trendId,
    resolution,
    tokenCost: quote.tokenCost,
  })
}
