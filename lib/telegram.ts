'use client'

import { useEffect, useEffectEvent } from 'react'

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

export type TelegramUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

type TelegramWebApp = {
  ready: () => void
  expand: () => void
  version: string
  platform: string
  initData?: string
  isVersionAtLeast?: (version: string) => boolean
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  openLink?: (url: string) => void
  openTelegramLink?: (url: string) => void
  downloadFile?: (
    params: { url: string; file_name: string },
    callback?: (accepted: boolean) => void,
  ) => void
  initDataUnsafe?: {
    user?: TelegramUser
    start_param?: string
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    selectionChanged: () => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined
  const app = window.Telegram?.WebApp
  if (!app || app.platform === 'unknown') return undefined
  return app
}

function supports(app: TelegramWebApp, version: string) {
  return app.isVersionAtLeast ? app.isVersionAtLeast(version) : false
}

export const haptics = {
  impact(style: HapticStyle = 'light') {
    const app = getWebApp()
    if (app && supports(app, '6.1')) app.HapticFeedback?.impactOccurred(style)
  },
  selection() {
    const app = getWebApp()
    if (app && supports(app, '6.1')) app.HapticFeedback?.selectionChanged()
  },
  success() {
    const app = getWebApp()
    if (app && supports(app, '6.1')) app.HapticFeedback?.notificationOccurred('success')
  },
}

export function useTelegramInit() {
  useEffect(() => {
    const app = getWebApp()
    if (!app) return
    app.ready()
    app.expand()
    if (supports(app, '6.1')) {
      app.setHeaderColor?.('#F5F8FC')
      app.setBackgroundColor?.('#F5F8FC')
    }
    if (supports(app, '7.10')) app.setBottomBarColor?.('#FFFFFF')
    if (supports(app, '7.7')) app.disableVerticalSwipes?.()
  }, [])
}

export function useTelegramBackButton(visible: boolean, onBack: () => void) {
  const handleBack = useEffectEvent(() => {
    haptics.impact('light')
    onBack()
  })

  useEffect(() => {
    const app = getWebApp()
    const button = app && supports(app, '6.1') ? app.BackButton : undefined
    if (!button) return
    if (!visible) {
      button.hide()
      return
    }
    const listener = () => handleBack()
    button.onClick(listener)
    button.show()
    return () => {
      button.offClick(listener)
      button.hide()
    }
  }, [visible])
}

export function getTelegramUser() {
  return getWebApp()?.initDataUnsafe?.user
}

export function getTelegramInitData() {
  return getWebApp()?.initData || ''
}

export function getTelegramStartParam() {
  return getWebApp()?.initDataUnsafe?.start_param
}

export function openExternalLink(url: string) {
  const app = getWebApp()
  if (app?.openLink) app.openLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function openTelegramLink(url: string) {
  const app = getWebApp()
  if (app?.openTelegramLink) app.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}
