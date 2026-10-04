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
    const duration = Math.max(1, Number(input.durationSeconds || 12))
    const resolution = String(input.resolution || '480p').toLowerCase()
    const quote = await quoteTokens({
      toolId,
      duration,
      resolution,
    })

    // Trend retail floors are customer-facing prices, separate from the
    // Professional model tool. Targets for a 12-second Seedance trend:
    // 480p = 250 tokens (~625 RUB at 2.5 RUB/token)
    // 720p = 370 tokens (~925 RUB at 2.5 RUB/token)
    const retailPerSecond = resolution === '720p'
      ? 370 / 12
      : resolution === '480p'
        ? 250 / 12
        : 0
    const retailFloor = retailPerSecond > 0
      ? Math.ceil((duration * retailPerSecond) / 5) * 5
      : 0

    return {
      ...quote,
      tokenCost: Math.max(quote.tokenCost, retailFloor),
    }
  }

  const configured = Math.max(0, Number(input.configuredTokenCost || 0))
  return {
    tokenCost: configured,
    providerUsd: 0,
    usdRub: 0,
  }
}
