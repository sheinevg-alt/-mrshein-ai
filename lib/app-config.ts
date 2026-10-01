export const APP_CONFIG = {
  name: 'Banana Zero',
  version: '0.4.0',
  defaultTokenBalance: 120,
  supportTelegram: 'https://t.me/BananaZero_Care_bot',
  website: 'https://BananaZero.ru',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://mrshein-ai-v3.vercel.app',
} as const

export const STORAGE_KEYS = {
  locale: 'mrshein.locale',
  favorites: 'mrshein.favorites',
  notifications: 'mrshein.notifications',
} as const
