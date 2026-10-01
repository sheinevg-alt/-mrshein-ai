'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type SiteLocale = 'ru' | 'en'

type SiteLocaleContextValue = {
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
  toggleLocale: () => void
}

const SiteLocaleContext = createContext<SiteLocaleContextValue | null>(null)

export function SiteLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>('ru')

  useEffect(() => {
    const saved = window.localStorage.getItem('banana-zero.site-locale')
    if (saved === 'ru' || saved === 'en') {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  function setLocale(next: SiteLocale) {
    setLocaleState(next)
    window.localStorage.setItem('banana-zero.site-locale', next)
    document.documentElement.lang = next
  }

  const value = useMemo(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === 'ru' ? 'en' : 'ru'),
  }), [locale])

  return <SiteLocaleContext.Provider value={value}>{children}</SiteLocaleContext.Provider>
}

export function useSiteLocale() {
  const value = useContext(SiteLocaleContext)
  if (!value) throw new Error('useSiteLocale must be used inside SiteLocaleProvider')
  return value
}
