'use client'

import { useEffect, useRef, useState } from 'react'
import type { CategoryId, Tool, Trend } from '@/lib/data'
import { haptics, useTelegramBackButton, useTelegramInit } from '@/lib/telegram'
import { BottomNav, type TabId } from './bottom-nav'
import { ToolSheet, TrendSheet } from './detail-sheets'
import { FavoritesProvider } from './favorites-provider'
import { I18nProvider } from './i18n-provider'
import { CategoryScreen } from './screens/category-screen'
import { CreateScreen } from './screens/create-screen'
import { FavoritesScreen } from './screens/favorites-screen'
import { ProfileScreen } from './screens/profile-screen'
import { TrendsScreen } from './screens/trends-screen'
import { WorksScreen } from './screens/works-screen'
import { TrendsProvider, useTrends } from './trends-provider'
import { UserProvider } from './user-provider'

export function AppShell() {
  useTelegramInit()
  return (
    <I18nProvider>
      <UserProvider>
        <TrendsProvider>
          <FavoritesProvider>
            <InnerApp />
          </FavoritesProvider>
        </TrendsProvider>
      </UserProvider>
    </I18nProvider>
  )
}

function InnerApp() {
  const { trends } = useTrends()
  const [tab, setTab] = useState<TabId>('trends')
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [activeTrend, setActiveTrend] = useState<Trend | null>(null)
  const deepLinkHandled = useRef(false)

  const sheetOpen = activeTool !== null || activeTrend !== null
  const canGoBack = sheetOpen || (tab === 'create' && category !== null)

  useEffect(() => {
    if (deepLinkHandled.current || trends.length === 0) return
    const trendId = new URLSearchParams(window.location.search).get('trend')
    if (!trendId) {
      deepLinkHandled.current = true
      return
    }
    const match = trends.find((trend) => trend.id === trendId)
    if (match) {
      setTab('trends')
      setActiveTrend(match)
    }
    deepLinkHandled.current = true
  }, [trends])

  function goBack() {
    if (activeTool) setActiveTool(null)
    else if (activeTrend) setActiveTrend(null)
    else if (category) setCategory(null)
  }

  useTelegramBackButton(canGoBack, goBack)

  function changeTab(next: TabId) {
    haptics.selection()
    if (next === tab && next === 'create') setCategory(null)
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  function openCategory(id: CategoryId) {
    haptics.impact('light')
    setCategory(id)
    setTab('create')
    window.scrollTo({ top: 0 })
  }

  function openTool(tool: Tool) {
    haptics.impact('light')
    setActiveTool(tool)
  }

  function openTrend(trend: Trend) {
    haptics.impact('light')
    setActiveTrend(trend)
  }

  function openWorksAfterGeneration() {
    setActiveTool(null)
    setActiveTrend(null)
    setCategory(null)
    setTab('works')
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <div className="mx-auto flex min-h-[var(--app-height)] w-full max-w-md flex-col">
        <main
          className="flex-1 px-4"
          style={{
            paddingTop: 'var(--app-safe-top)',
            paddingBottom: 'calc(var(--app-safe-bottom) + var(--nav-height) + 1.5rem)',
          }}
        >
          {tab === 'trends' && <TrendsScreen onOpenTrend={openTrend} onOpenCategory={openCategory} />}
          {tab === 'create' &&
            (category ? (
              <CategoryScreen categoryId={category} onBack={() => setCategory(null)} onOpenTool={openTool} />
            ) : (
              <CreateScreen onOpenCategory={openCategory} />
            ))}
          {tab === 'works' && <WorksScreen />}
          {tab === 'favorites' && (
            <FavoritesScreen onOpenTool={openTool} onOpenTrend={openTrend} onBrowse={() => changeTab('trends')} />
          )}
          {tab === 'profile' && <ProfileScreen />}
        </main>
      </div>

      <BottomNav active={tab} onChange={changeTab} />
      <ToolSheet tool={activeTool} onClose={() => setActiveTool(null)} />
      <TrendSheet
        trend={activeTrend}
        onClose={() => setActiveTrend(null)}
        onGenerationStarted={openWorksAfterGeneration}
      />
    </>
  )
}
