export const PUBLIC_PLANS = [
  {
    code: 'beginner',
    name: 'Beginner',
    priceRub: 1490,
    regularRub: 1650,
    tokens: 660,
    discountPct: 10,
  },
  {
    code: 'creator',
    name: 'Creator',
    priceRub: 2990,
    regularRub: 3525,
    tokens: 1410,
    discountPct: 15,
  },
  {
    code: 'professional',
    name: 'Professional',
    priceRub: 4990,
    regularRub: 6250,
    tokens: 2500,
    discountPct: 20,
  },
] as const

export const TOKEN_PURCHASE_MIN = 200
export const TOKEN_PURCHASE_MAX = 3000
export const TOKEN_PURCHASE_STEP = 100

export function normalizeTokenPurchaseAmount(value: number) {
  const numeric = Number.isFinite(value) ? Math.round(value) : TOKEN_PURCHASE_MIN
  const clamped = Math.max(TOKEN_PURCHASE_MIN, Math.min(TOKEN_PURCHASE_MAX, numeric))
  return Math.round(clamped / TOKEN_PURCHASE_STEP) * TOKEN_PURCHASE_STEP
}

export function getTokenPurchaseQuote(value: number) {
  const tokens = normalizeTokenPurchaseAmount(value)
  const regularRub = Math.round(tokens * 2.5)

  let priceRub = regularRub
  if (tokens >= 3000) priceRub = 6500
  else if (tokens >= 2000) priceRub = Math.round(tokens * 2.25)
  else if (tokens >= 1000) priceRub = Math.round(tokens * 2.3)

  const savingsRub = Math.max(0, regularRub - priceRub)
  const discountPct = savingsRub > 0 ? Math.round((savingsRub / regularRub) * 100) : 0

  return { tokens, regularRub, priceRub, savingsRub, discountPct }
}

// Kept for compatibility with any older links/components.
export const PUBLIC_TOKEN_PACKS = [200, 500, 1000, 2000, 3000].map(getTokenPurchaseQuote)

export const TOKEN_REFERENCE_RUB = 2.5
