'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { CategoryId, Tool, Trend } from '@/lib/data'
import { haptics, useTelegramBackButton, useTelegramInit } from '@/lib/telegram'
import { BottomNav, type TabId } from './bottom-nav'
import { ToolSheet, TrendSheet } from './detail-sheets'
import { FavoritesProvider } from './favorites-provider'
import { I18nProvider, useI18n } from './i18n-provider'
import { CategoryScreen } from './screens/category-screen'
import { CreateScreen } from './screens/create-screen'
import { FavoritesScreen } from './screens/favorites-screen'
import { ProfileScreen } from './screens/profile-screen'
import { TrendsScreen } from './screens/trends-screen'
import { WorksScreen } from './screens/works-screen'
import { TrendsProvider, useTrends } from './trends-provider'
import { SeedanceSheet } from './seedance-sheet'
import { RepeatGenerationSheet } from './repeat-generation-sheet'
import { UserProvider, useUserState } from './user-provider'

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
  const { locale } = useI18n()
  const { trends } = useTrends()
  const { completionNotice, clearCompletionNotice, unreadWorks, markWorksSeen } = useUserState()
  const [tab, setTab] = useState<TabId>('trends')
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [activeTrend, setActiveTrend] = useState<Trend | null>(null)
  const [seedanceOpen, setSeedanceOpen] = useState(false)
  const [repeatJobId, setRepeatJobId] = useState<string | null>(null)
  const deepLinkHandled = useRef(false)

  const sheetOpen = activeTool !== null || activeTrend !== null || seedanceOpen || repeatJobId !== null
  const canGoBack = sheetOpen || (tab === 'create' && category !== null)

  useEffect(() => {
    if (deepLinkHandled.current || trends.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const workId = params.get('work')
    if (workId) {
      setTab('works')
      markWorksSeen()
      deepLinkHandled.current = true
      return
    }

    const trendId = params.get('trend')
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
  }, [markWorksSeen, trends])

  function goBack() {
    if (repeatJobId) setRepeatJobId(null)
    else if (seedanceOpen) setSeedanceOpen(false)
    else if (activeTool) setActiveTool(null)
    else if (activeTrend) setActiveTrend(null)
    else if (category) setCategory(null)
  }

  useTelegramBackButton(canGoBack, goBack)

  function changeTab(next: TabId) {
    haptics.selection()
    if (next === tab && next === 'create') setCategory(null)
    if (next === 'works') markWorksSeen()
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
    setRepeatJobId(null)
    setSeedanceOpen(false)
    setActiveTool(null)
    setActiveTrend(null)
    setCategory(null)
    setTab('works')
    markWorksSeen()
    window.scrollTo({ top: 0 })
  }

  function openCompletedWork() {
    haptics.success()
    clearCompletionNotice()
    markWorksSeen()
    setSeedanceOpen(false)
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
              <CreateScreen onOpenCategory={openCategory} onOpenSeedance={() => { haptics.impact('light'); setSeedanceOpen(true) }} />
            ))}
          {tab === 'works' && <WorksScreen onRepeatGeneration={(jobId) => setRepeatJobId(jobId)} />}
          {tab === 'favorites' && (
            <FavoritesScreen onOpenTool={openTool} onOpenTrend={openTrend} onBrowse={() => changeTab('trends')} />
          )}
          {tab === 'profile' && <ProfileScreen />}
        </main>
      </div>

      {completionNotice && tab !== 'works' && (
        <div className="fixed inset-x-0 z-50 mx-auto w-full max-w-md px-4" style={{ bottom: 'calc(var(--app-safe-bottom) + var(--nav-height) + 0.75rem)' }}>
          <div className="glass-strong flex items-center gap-3 rounded-2xl p-3 shadow-xl">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </span>
            <button type="button" onClick={openCompletedWork} className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold">{locale === 'ru' ? 'Ваше видео готово' : 'Your video is ready'}</span>
              <span className="block truncate text-xs text-muted-foreground">{locale === 'ru' ? 'Нажмите, чтобы посмотреть результат' : 'Tap to view the result'}</span>
            </button>
            <button type="button" onClick={clearCompletionNotice} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground" aria-label={locale === 'ru' ? 'Закрыть' : 'Close'}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <BottomNav active={tab} onChange={changeTab} worksBadge={unreadWorks} />
      <SeedanceSheet open={seedanceOpen} onClose={() => setSeedanceOpen(false)} onGenerationStarted={openWorksAfterGeneration} />
      <RepeatGenerationSheet jobId={repeatJobId} onClose={() => setRepeatJobId(null)} onGenerationStarted={openWorksAfterGeneration} />
      <ToolSheet tool={activeTool} onClose={() => setActiveTool(null)} />
      <TrendSheet
        trend={activeTrend}
        onClose={() => setActiveTrend(null)}
        onGenerationStarted={openWorksAfterGeneration}
      />
    </>
  )
}
