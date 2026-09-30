'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/app-config'
import { haptics } from '@/lib/telegram'

type FavoritesContextValue = {
  favorites: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)
const DEFAULT_FAVORITES = ['text-to-image', 'action-figure']

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(DEFAULT_FAVORITES))

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.favorites) || 'null')
      if (Array.isArray(saved)) setFavorites(new Set(saved.filter((item) => typeof item === 'string')))
    } catch {
      // Keep defaults if storage is malformed.
    }
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    haptics.impact('soft')
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      window.localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...next]))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ favorites, isFavorite: (id: string) => favorites.has(id), toggleFavorite }),
    [favorites, toggleFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
