'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { APP_CONFIG, STORAGE_KEYS } from '@/lib/app-config'
import { getTelegramInitData } from '@/lib/telegram'

export type HistoryItem = {
  id: string
  type: 'trend' | 'tool'
  title: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  createdAt: string
  resultUrl?: string | null
  error?: string | null
  provider?: string | null
  model?: string | null
  sourceId?: string | null
}

type UserContextValue = {
  tokenBalance: number
  history: HistoryItem[]
  notificationsEnabled: boolean
  setNotificationsEnabled: (value: boolean) => Promise<void>
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [tokenBalance, setTokenBalance] = useState(APP_CONFIG.defaultTokenBalance)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [notificationsEnabled, setNotificationsLocal] = useState(true)

  const refreshUser = useCallback(async () => {
    const initData = getTelegramInitData()
    if (!initData) return

    await Promise.all([
      fetch('/api/me', {
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return
          if (typeof data.tokenBalance === 'number') setTokenBalance(data.tokenBalance)
          if (typeof data.notificationsEnabled === 'boolean') {
            setNotificationsLocal(data.notificationsEnabled)
            window.localStorage.setItem(STORAGE_KEYS.notifications, data.notificationsEnabled ? '1' : '0')
          }
        })
        .catch(() => undefined),
      fetch('/api/history', {
        headers: { 'X-Telegram-Init-Data': initData },
        cache: 'no-store',
      })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (Array.isArray(data?.history)) setHistory(data.history)
        })
        .catch(() => undefined),
    ])
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.notifications)
    if (stored === '0' || stored === '1') setNotificationsLocal(stored === '1')
    void refreshUser()
  }, [refreshUser])

  const setNotificationsEnabled = useCallback(async (value: boolean) => {
    setNotificationsLocal(value)
    window.localStorage.setItem(STORAGE_KEYS.notifications, value ? '1' : '0')

    const initData = getTelegramInitData()
    if (!initData) return
    try {
      await fetch('/api/me/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ enabled: value }),
      })
    } catch {
      // The local preference still works if backend storage is not connected yet.
    }
  }, [])

  const value = useMemo(
    () => ({ tokenBalance, history, notificationsEnabled, setNotificationsEnabled, refreshUser }),
    [tokenBalance, history, notificationsEnabled, setNotificationsEnabled, refreshUser],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUserState() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUserState must be used within UserProvider')
  return context
}
