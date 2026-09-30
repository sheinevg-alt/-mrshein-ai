import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/admin-auth'
import { broadcastNewTrend } from '@/lib/server/telegram-bot'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

function slugify(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'trend'
  return `${base}-${randomUUID().slice(0, 6)}`
}

export async function GET(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
  const response = await supabaseFetch('trends?select=*&order=created_at.desc')
  if (!response.ok) return NextResponse.json({ error: 'Could not load trends' }, { status: 500 })
  return NextResponse.json({ trends: await response.json() })
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })

  const body = await request.json().catch(() => null)
  if (!body?.title_en || !body?.category || !body?.image_url || !Number.isFinite(Number(body?.token_cost))) {
    return NextResponse.json({ error: 'title_en, category, image_url and token_cost are required' }, { status: 400 })
  }

  const row = {
    id: body.id || slugify(body.title_en),
    title_en: String(body.title_en),
    title_ru: body.title_ru ? String(body.title_ru) : null,
    category: String(body.category),
    image_url: String(body.image_url),
    preview_video_url: body.preview_video_url ? String(body.preview_video_url) : null,
    uses_count: body.uses_count ? String(body.uses_count) : 'New',
    token_cost: Number(body.token_cost),
    input_schema: Array.isArray(body.input_schema) ? body.input_schema : [],
    provider: body.provider ? String(body.provider) : null,
    model: body.model ? String(body.model) : null,
    hidden_prompt: body.hidden_prompt ? String(body.hidden_prompt) : null,
    output_type: body.output_type ? String(body.output_type) : String(body.category),
    duration_seconds: Number.isFinite(Number(body.duration_seconds)) ? Number(body.duration_seconds) : null,
    aspect_ratio: body.aspect_ratio ? String(body.aspect_ratio) : '9:16',
    generation_config: body.generation_config && typeof body.generation_config === 'object' ? body.generation_config : {},
    pro_prompt_template: body.pro_prompt_template ? String(body.pro_prompt_template) : null,
    pro_editable: Boolean(body.pro_editable),
    published: Boolean(body.published),
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100,
    updated_at: new Date().toISOString(),
  }

  const response = await supabaseFetch('trends', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!response.ok) return NextResponse.json({ error: await response.text() }, { status: 500 })
  const created = (await response.json())?.[0]
  let notification = null
  if (row.published && body.notify_users) {
    try { notification = await broadcastNewTrend(row.id) } catch (error) { notification = { error: error instanceof Error ? error.message : 'Broadcast failed' } }
  }
  return NextResponse.json({ trend: created, notification })
}
