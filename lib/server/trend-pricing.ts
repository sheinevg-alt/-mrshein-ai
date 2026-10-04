import 'server-only'

import { quoteTokens } from './model-pricing'

export type TrendPricingInput = {
  provider?: string | null
  model?: string | null
  durationSeconds?: number | null
  resolution?: string | null
  configuredTokenCost?: number | null
}

function toolIdForTrend(model: string) {
  const normalized = model.toLowerCase()
  if (
    normalized === 'seedance-2.5' ||
    normalized === 'seedance2_5' ||
    normalized === 'dreamina-seedance-2-5-260628'
  ) return 'seedance-2-5'
  return ''
}

export async function quoteTrendTokens(input: TrendPricingInput) {
  const toolId = toolIdForTrend(String(input.model || ''))
  if (toolId) {
    return quoteTokens({
      toolId,
      duration: Math.max(1, Number(input.durationSeconds || 12)),
      resolution: String(input.resolution || '480p').toLowerCase(),
    })
  }

  const configured = Math.max(0, Number(input.configuredTokenCost || 0))
  return {
    tokenCost: configured,
    providerUsd: 0,
    usdRub: 0,
  }
}
