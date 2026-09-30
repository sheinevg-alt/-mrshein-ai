'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, normalizeLocale, translate, type Locale, type MessageKey } from '@/lib/i18n'
import { STORAGE_KEYS } from '@/lib/app-config'
import { getTelegramUser } from '@/lib/telegram'

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.locale)
    if (stored === 'en' || stored === 'ru') {
      setLocaleState(stored)
      return
    }
    const detected = normalizeLocale(getTelegramUser()?.language_code)
    setLocaleState(detected)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEYS.locale, next)
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(key, vars, locale),
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
