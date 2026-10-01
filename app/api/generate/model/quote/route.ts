import { NextResponse } from 'next/server'
import { quoteTokens } from '@/lib/server/model-pricing'
import { getModelDefinition } from '@/lib/model-catalog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON_BODY_REQUIRED' }, { status: 415 })
  const toolId = String((body as any).toolId || '')
  const tool = getModelDefinition(toolId)
  if (!tool) return NextResponse.json({ error: 'MODEL_NOT_AVAILABLE' }, { status: 404 })
  const settings = (body as any).settings || {}
  const promptLength = Math.max(0, Number((body as any).promptLength || 0))
  const quote = await quoteTokens({
    toolId,
    duration: settings.duration,
    resolution: settings.resolution,
    quality: settings.quality,
    mode: settings.mode,
    generateAudio: settings.generateAudio,
    promptLength,
  })
  return NextResponse.json({
    ok: true,
    tokenCost: quote.tokenCost,
  })
}
