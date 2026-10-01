'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'banana-zero.theme'

function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial: ThemeMode = stored === 'dark' || stored === 'system' || stored === 'light' ? stored : 'light'
    setThemeState(initial)
    applyTheme(initial)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY)
      if (current === 'system') applyTheme('system')
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
