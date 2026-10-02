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

export const PUBLIC_TOKEN_PACKS = [
  { tokens: 200, priceRub: 500 },
  { tokens: 500, priceRub: 1250 },
  { tokens: 1000, priceRub: 2500 },
  { tokens: 2000, priceRub: 5000 },
] as const

export const TOKEN_REFERENCE_RUB = 2.5
