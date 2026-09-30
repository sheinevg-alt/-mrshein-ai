'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fallbackTrends, type Trend } from '@/lib/data'

type TrendsContextValue = {
  trends: Trend[]
  loading: boolean
  refresh: () => Promise<void>
}

const TrendsContext = createContext<TrendsContextValue | null>(null)

export function TrendsProvider({ children }: { children: React.ReactNode }) {
  const [trends, setTrends] = useState<Trend[]>(fallbackTrends)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const response = await fetch('/api/trends', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      if (Array.isArray(data?.trends) && data.trends.length > 0) setTrends(data.trends)
    } catch {
      // Static fallback keeps the Mini App usable before the database is connected.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = useMemo(() => ({ trends, loading, refresh }), [trends, loading])
  return <TrendsContext.Provider value={value}>{children}</TrendsContext.Provider>
}

export function useTrends() {
  const context = useContext(TrendsContext)
  if (!context) throw new Error('useTrends must be used within TrendsProvider')
  return context
}
