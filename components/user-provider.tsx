'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG, STORAGE_KEYS } from '@/lib/app-config'
import { getTelegramInitData } from '@/lib/telegram'

export type HistoryItem = {
  id: string
  type: 'trend' | 'tool'
  title: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  createdAt: string
  failedAt?: string | null
  resultUrl?: string | null
  error?: string | null
  failureType?: 'temporary' | 'input' | 'provider' | null
  retryable?: boolean
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
  completionNotice: HistoryItem | null
  clearCompletionNotice: () => void
  unreadWorks: boolean
  markWorksSeen: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [tokenBalance, setTokenBalance] = useState(APP_CONFIG.defaultTokenBalance)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [notificationsEnabled, setNotificationsLocal] = useState(true)
  const [completionNotice, setCompletionNotice] = useState<HistoryItem | null>(null)
  const [unreadWorks, setUnreadWorks] = useState(false)
  const previousStatuses = useRef<Map<string, HistoryItem['status']>>(new Map())

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
          if (!Array.isArray(data?.history)) return
          const nextHistory = data.history as HistoryItem[]
          let newlyCompleted: HistoryItem | null = null

          for (const item of nextHistory) {
            const previous = previousStatuses.current.get(item.id)
            if ((previous === 'queued' || previous === 'processing') && item.status === 'completed') {
              newlyCompleted = item
              break
            }
          }

          previousStatuses.current = new Map(nextHistory.map((item) => [item.id, item.status]))
          setHistory(nextHistory)

          if (newlyCompleted) {
            setCompletionNotice(newlyCompleted)
            setUnreadWorks(true)
          }
        })
        .catch(() => undefined),
    ])
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.notifications)
    if (stored === '0' || stored === '1') setNotificationsLocal(stored === '1')
    void refreshUser()
  }, [refreshUser])

  const activeIdsKey = useMemo(
    () => history
      .filter((item) => item.status === 'queued' || item.status === 'processing')
      .map((item) => item.id)
      .join('|'),
    [history],
  )

  useEffect(() => {
    if (!activeIdsKey) return
    const initData = getTelegramInitData()
    if (!initData) return

    const ids = activeIdsKey.split('|').filter(Boolean)
    let cancelled = false
    let running = false

    async function syncJobs() {
      if (running || cancelled) return
      running = true
      try {
        await Promise.all(ids.map((jobId) =>
          fetch(`/api/generate/status?jobId=${encodeURIComponent(jobId)}`, {
            headers: { 'X-Telegram-Init-Data': initData },
            cache: 'no-store',
          }).catch(() => undefined),
        ))
        if (!cancelled) await refreshUser()
      } finally {
        running = false
      }
    }

    void syncJobs()
    const timer = window.setInterval(() => void syncJobs(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeIdsKey, refreshUser])

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
      // Keep the local preference even if backend storage is temporarily unavailable.
    }
  }, [])

  const clearCompletionNotice = useCallback(() => setCompletionNotice(null), [])
  const markWorksSeen = useCallback(() => {
    setUnreadWorks(false)
    setCompletionNotice(null)
  }, [])

  const value = useMemo(
    () => ({
      tokenBalance,
      history,
      notificationsEnabled,
      setNotificationsEnabled,
      refreshUser,
      completionNotice,
      clearCompletionNotice,
      unreadWorks,
      markWorksSeen,
    }),
    [
      tokenBalance,
      history,
      notificationsEnabled,
      setNotificationsEnabled,
      refreshUser,
      completionNotice,
      clearCompletionNotice,
      unreadWorks,
      markWorksSeen,
    ],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUserState() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUserState must be used within UserProvider')
  return context
}
