import 'server-only'

import { supabaseFetch } from './supabase'

const FALLBACK_USD_RUB = 90

async function configuredUsdRub() {
  try {
    const response = await supabaseFetch('app_settings?select=value&key=eq.pricing_examples_20260930&limit=1')
    if (!response.ok) return FALLBACK_USD_RUB
    const row = (await response.json())?.[0]
    const value = Number(row?.value?.usd_rub)
    return Number.isFinite(value) && value > 0 ? value : FALLBACK_USD_RUB
  } catch {
    return FALLBACK_USD_RUB
  }
}

export type ToolQuoteInput = {
  toolId: string
  duration?: number
  resolution?: string
  quality?: string
  mode?: string
  generateAudio?: boolean
  promptLength?: number
}

export function estimateProviderUsd(input: ToolQuoteInput) {
  const duration = Math.max(1, Number(input.duration || 5))
  const resolution = String(input.resolution || '').toLowerCase()
  const quality = String(input.quality || 'medium').toLowerCase()
  const mode = String(input.mode || 'std').toLowerCase()

  switch (input.toolId) {
    case 'video-upscale': {
      const rate = resolution === '4k' ? 0.06 : resolution === '2k' ? 0.035 : resolution === '1080p' ? 0.03 : 0.02
      return duration * rate
    }
    case 'image-upscale':
      return 0.004
    case 'seedance-2-5':
      return duration * (resolution === '720p' ? 0.27 : 0.12)
    case 'omni-flash':
      if (mode === 'video-edit') return resolution === '4k' ? 1.05 : 0.70
      return duration * (resolution === '4k' ? 0.20 : resolution === '1080p' ? 0.10 : 0.07)
    case 'kling-v3': {
      const rate = mode === 'pro'
        ? (input.generateAudio ? 0.24 : 0.16)
        : (input.generateAudio ? 0.18 : 0.12)
      return duration * rate
    }
    case 'kling-v3-omni':
      return duration * 0.15
    case 'kling-motion-control':
      return duration * (resolution === '1080p' ? 0.10 : 0.06)
    case 'nano-banana-2':
      return resolution === '4k' ? 0.08 : 0.05
    case 'nano-banana-pro':
      return resolution === '4k' ? 0.15 : 0.10
    case 'gpt-image-2-5': {
      const table: Record<string, Record<string, number>> = {
        '1k': { low: 0.008, medium: 0.025, high: 0.045, xhigh: 0.08, max: 0.18 },
        '2k': { low: 0.012, medium: 0.028, high: 0.09, xhigh: 0.16, max: 0.35 },
        '4k': { low: 0.020, medium: 0.045, high: 0.15, xhigh: 0.26, max: 0.58 },
      }
      return table[resolution || '2k']?.[quality] ?? 0.028
    }
    case 'suno-v5':
      return 0.26
    case 'elevenlabs-tts':
      return Math.max(0.01, (Math.max(1, input.promptLength || 1) / 1000) * 0.04)
    case 'kling-audio':
      return 0.05
    case 'gpt-6-luna':
    case 'gpt-6-sol':
    case 'claude-sonnet-5':
      return 0.02
    default:
      return 0.10
  }
}

export async function quoteTokens(input: ToolQuoteInput) {
  const providerUsd = estimateProviderUsd(input)
  const usdRub = await configuredUsdRub()
  const providerRub = providerUsd * usdRub
  const response = await supabaseFetch('rpc/price_tokens_from_provider_cost', {
    method: 'POST',
    body: JSON.stringify({ provider_cost_rub: providerRub }),
  })
  if (response.ok) {
    const tokenCost = Number(await response.json())
    if (Number.isFinite(tokenCost) && tokenCost >= 0) return { tokenCost, providerUsd, usdRub }
  }
  const tokenCost = Math.max(5, Math.ceil(((providerRub * 3.1) / 2.5) / 5) * 5)
  return { tokenCost, providerUsd, usdRub }
}
