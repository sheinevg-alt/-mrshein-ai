import 'server-only'
import { fallbackTrends, type CategoryId, type Trend, type TrendInput, type TrendInputKind } from '@/lib/data'
import { hasDatabase, supabaseFetch } from './supabase'

type RawInput = Record<string, unknown>

type TrendRow = {
  id: string
  title_en: string
  title_ru?: string | null
  category: CategoryId
  image_url: string
  preview_video_url?: string | null
  aspect_ratio?: string | null
  uses_count?: string | null
  token_cost: number
  input_schema?: RawInput[] | null
  generation_config?: Record<string, unknown> | null
}

function normalizeKind(value: unknown): TrendInputKind {
  const raw = String(value || 'photo').toLowerCase()
  if (raw === 'image') return 'photo'
  if (raw === 'video' || raw === 'audio' || raw === 'text') return raw
  return 'photo'
}

function normalizeInput(input: RawInput): TrendInput {
  const labelObj = input.label && typeof input.label === 'object' ? input.label as Record<string, unknown> : null
  const hintObj = input.hint && typeof input.hint === 'object' ? input.hint as Record<string, unknown> : null
  const defaultObj = input.default_asset && typeof input.default_asset === 'object' ? input.default_asset as Record<string, unknown> : null
  const defaultUrl = String(input.default_asset_url || defaultObj?.url || '')

  return {
    id: String(input.id || 'input'),
    kind: normalizeKind(input.kind || input.type),
    label: {
      en: String(labelObj?.en || input.label_en || input.label_ru || input.id || 'Input'),
      ru: String(labelObj?.ru || input.label_ru || '') || undefined,
    },
    hint: hintObj || input.hint_en || input.hint_ru ? {
      en: String(hintObj?.en || input.hint_en || ''),
      ru: String(hintObj?.ru || input.hint_ru || '') || undefined,
    } : undefined,
    required: Boolean(input.required),
    tag: input.tag ? String(input.tag) : undefined,
    defaultAsset: defaultUrl ? { url: defaultUrl, name: String(defaultObj?.name || input.default_asset_name || 'Default') } : undefined,
    replaceable: input.replaceable === undefined ? true : Boolean(input.replaceable),
    removable: Boolean(input.removable),
  }
}

function toPublicTrend(row: TrendRow): Trend {
  const config = row.generation_config && typeof row.generation_config === 'object' ? row.generation_config : {}
  const rawResolutions = Array.isArray(config.allowed_resolutions) ? config.allowed_resolutions : []
  const resolutions = rawResolutions
    .map((value) => String(value))
    .filter((value): value is '480p' | '720p' | '1080p' => ['480p', '720p', '1080p'].includes(value))

  return {
    id: row.id,
    title: { en: row.title_en, ru: row.title_ru || undefined },
    category: row.category,
    image: row.image_url,
    previewVideo: row.preview_video_url || undefined,
    aspectRatio: row.aspect_ratio || undefined,
    uses: row.uses_count || 'New',
    tokens: row.token_cost,
    inputs: Array.isArray(row.input_schema) ? row.input_schema.map(normalizeInput) : [],
    resolutions: resolutions.length ? resolutions : undefined,
    executionMode: String(config.execution_mode || '') === 'direct' ? 'direct' : undefined,
    cardBadge: ['hit', 'new', 'popular'].includes(String(config.card_badge || '').toLowerCase())
      ? String(config.card_badge).toLowerCase() as 'hit' | 'new' | 'popular'
      : undefined,
    generateAudioDefault: config.default_generate_audio === undefined
      ? undefined
      : Boolean(config.default_generate_audio),
    generateAudioLocked: Boolean(config.lock_audio),
  }
}

export async function getPublicTrends(): Promise<Trend[]> {
  if (!hasDatabase()) return fallbackTrends
  const response = await supabaseFetch(
    'trends?select=id,title_en,title_ru,category,image_url,preview_video_url,aspect_ratio,uses_count,token_cost,input_schema,generation_config&published=eq.true&order=sort_order.asc,created_at.desc',
  )
  if (!response.ok) return fallbackTrends
  const rows = (await response.json()) as TrendRow[]
  return rows.length ? rows.map(toPublicTrend) : fallbackTrends
}
