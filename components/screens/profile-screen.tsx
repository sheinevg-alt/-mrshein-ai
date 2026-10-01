'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  Bell,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Gift,
  Copy,
  LifeBuoy,
  Monitor,
  Moon,
  Settings,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { APP_CONFIG } from '@/lib/app-config'
import type { Locale, MessageKey } from '@/lib/i18n'
import { getTelegramInitData, getTelegramUser } from '@/lib/telegram'
import { BottomSheet } from '../bottom-sheet'
import { useFavorites } from '../favorites-provider'
import { useI18n } from '../i18n-provider'
import { ScreenHeader } from '../screen-header'
import { useUserState } from '../user-provider'
import { SupportPanel } from '../support-panel'
import { useTheme, type ThemeMode } from '../theme-provider'

const noopSubscribe = () => () => {}
type Panel = 'history' | 'notifications' | 'language' | 'settings' | 'help' | 'tokens' | 'referral' | null

function useTelegramProfile() {
  return useSyncExternalStore(noopSubscribe, () => getTelegramUser() ?? null, () => null)
}

const menu: { id: Exclude<Panel, null | 'tokens'>; label: MessageKey; icon: LucideIcon }[] = [
  { id: 'referral', label: 'profile.referral', icon: Gift },
  { id: 'history', label: 'profile.history', icon: Clock },
  { id: 'notifications', label: 'profile.notifications', icon: Bell },
  { id: 'language', label: 'profile.language', icon: Globe },
  { id: 'settings', label: 'profile.settings', icon: Settings },
  { id: 'help', label: 'profile.help', icon: LifeBuoy },
]

export function ProfileScreen() {
  const { t, locale } = useI18n()
  const user = useTelegramProfile()
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || t('profile.guest') : t('profile.guest')
  const initial = name.charAt(0).toUpperCase()
  const { favorites } = useFavorites()
  const { tokenBalance, history, notificationsEnabled } = useUserState()
  const [panel, setPanel] = useState<Panel>(null)

  const menuValue = (id: Exclude<Panel, null | 'tokens'>) => {
    if (id === 'notifications') return t(notificationsEnabled ? 'profile.notificationsOn' : 'profile.notificationsOff')
    if (id === 'language') return locale === 'ru' ? t('language.russian') : t('language.english')
    return null
  }

  return (
    <div className="animate-in fade-in duration-300">
      <ScreenHeader title={t('profile.title')} />

      <section className="glass flex items-center gap-4 rounded-3xl p-4">
        {user?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Telegram provides a remote profile URL
          <img src={user.photo_url} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <span className="brand-gradient flex size-14 items-center justify-center rounded-full text-xl font-semibold text-white" aria-hidden="true">{initial}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{t('profile.plan')}</p>
        </div>
      </section>

      <section aria-label={t('profile.usage')} className="mt-3 grid grid-cols-3 gap-3">
        {[
          { label: t('profile.tokens'), value: String(tokenBalance) },
          { label: t('profile.created'), value: String(history.length) },
          { label: t('profile.saved'), value: String(favorites.size) },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-2xl p-3.5">
            <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </section>

      <button type="button" onClick={() => setPanel('tokens')} className="brand-gradient mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left text-white shadow-[0_12px_28px_-14px_oklch(0.5_0.21_264/0.8)] transition active:scale-[0.98]">
        <Sparkles className="size-5" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">{t('profile.getTokens')}</span>
          <span className="block text-xs opacity-80">{t('profile.getTokensHint')}</span>
        </span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>

      <ul className="glass mt-6 divide-y overflow-hidden rounded-2xl">
        {menu.map(({ id, label, icon: Icon }) => {
          const value = menuValue(id)
          return (
            <li key={id}>
              <button type="button" onClick={() => setPanel(id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-muted">
                <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1 text-sm">{t(label)}</span>
                {value && <span className="text-xs text-muted-foreground">{value}</span>}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">{t('profile.version', { version: APP_CONFIG.version })}</p>
      <ProfilePanel panel={panel} onClose={() => setPanel(null)} />
    </div>
  )
}

function ProfilePanel({ panel, onClose }: { panel: Panel; onClose: () => void }) {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const { history, notificationsEnabled, setNotificationsEnabled } = useUserState()
  if (!panel) return null

  const titleKey: Record<Exclude<Panel, null>, MessageKey> = {
    history: 'history.title',
    notifications: 'notifications.title',
    language: 'language.title',
    settings: 'settings.title',
    help: 'help.title',
    referral: 'referral.title',
    tokens: 'tokens.title',
  }

  return (
    <BottomSheet open title={t(titleKey[panel])} onClose={onClose}>
      {panel === 'history' && (
        history.length === 0 ? (
          <div className="py-8 text-center">
            <Clock className="mx-auto size-8 text-brand" />
            <p className="mt-3 text-sm font-medium">{t('history.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('history.emptyBody')}</p>
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {history.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}</p>
              </li>
            ))}
          </ul>
        )
      )}

      {panel === 'notifications' && (
        <div className="pb-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{t('notifications.description')}</p>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => void setNotificationsEnabled(!notificationsEnabled)}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border p-4 text-left"
          >
            <Bell className="size-5 text-brand" />
            <span className="flex-1 text-sm font-medium">{t('notifications.toggle')}</span>
            <span className={`relative h-7 w-12 rounded-full transition ${notificationsEnabled ? 'bg-brand' : 'bg-muted'}`}>
              <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${notificationsEnabled ? 'left-6' : 'left-1'}`} />
            </span>
          </button>
        </div>
      )}

      {panel === 'language' && (
        <div className="pb-2">
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t('language.auto')}</p>
          {([['ru', 'language.russian'], ['en', 'language.english']] as [Locale, MessageKey][]).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setLocale(id)} className="mb-2 flex w-full items-center gap-3 rounded-2xl border p-4 text-left active:bg-muted">
              <Globe className="size-5 text-brand" />
              <span className="flex-1 text-sm font-medium">{t(label)}</span>
              {locale === id && <Check className="size-5 text-brand" />}
            </button>
          ))}
        </div>
      )}

      {panel === 'settings' && (
        <div className="space-y-3">
          <div className="rounded-2xl border p-3">
            <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">{locale === 'ru' ? 'Тема' : 'Theme'}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['light', Sun, locale === 'ru' ? 'Светлая' : 'Light'],
                ['dark', Moon, locale === 'ru' ? 'Тёмная' : 'Dark'],
                ['system', Monitor, locale === 'ru' ? 'Система' : 'System'],
              ] as [ThemeMode, LucideIcon, string][]).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-medium transition active:scale-95 ${theme === id ? 'border-brand bg-brand-tint text-brand' : 'bg-card text-muted-foreground'}`}
                >
                  <Icon className={`size-4 ${id === 'dark' && theme === id ? 'text-banana' : ''}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y rounded-2xl border">
            <div className="flex items-center justify-between px-4 py-3"><span className="text-sm">{t('settings.version')}</span><span className="text-xs text-muted-foreground">{APP_CONFIG.version}</span></div>
            <div className="flex items-center justify-between px-4 py-3"><span className="text-sm">{t('settings.telegram')}</span><span className="text-xs text-muted-foreground">Active</span></div>
          </div>
        </div>
      )}

      {panel === 'help' && <SupportPanel />}
      {panel === 'referral' && <ReferralPanel />}

      {panel === 'tokens' && <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{t('tokens.soon')}</p>}
    </BottomSheet>
  )
}


type ReferralData = {
  referralCode: string
  referralLink: string | null
  commissionPct: number
  invitedCount: number
  availableRub: number
  pendingRub: number
  totalEarnedRub: number
  referredRevenueRub: number
}

function ReferralPanel() {
  const { t, locale } = useI18n()
  const { refreshUser } = useUserState()
  const [data, setData] = useState<ReferralData | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const initData = getTelegramInitData()
    if (!initData) {
      setStatus(locale === 'ru' ? 'Реферальный кабинет доступен после входа через Telegram.' : 'Referral dashboard is available after Telegram sign-in.')
      return
    }
    const response = await fetch('/api/referrals/me', {
      headers: { 'X-Telegram-Init-Data': initData },
      cache: 'no-store',
    })
    const next = await response.json().catch(() => null)
    if (!response.ok) {
      setStatus(locale === 'ru' ? 'Не удалось загрузить реферальный кабинет.' : 'Could not load referral dashboard.')
      return
    }
    setData(next)
    setStatus('')
  }

  useEffect(() => { void load() }, [])

  async function copyLink() {
    if (!data?.referralLink) return
    await navigator.clipboard.writeText(data.referralLink)
    setStatus(t('referral.copied'))
  }

  async function convertAll() {
    if (!data || data.availableRub <= 0 || busy) return
    const initData = getTelegramInitData()
    if (!initData) return
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/api/referrals/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ action: 'convert_to_tokens', amountRub: data.availableRub }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(result?.error || 'CONVERSION_FAILED'))
      setStatus(locale === 'ru'
        ? `Начислено токенов: ${Number(result.tokensAdded || 0)}`
        : `Tokens added: ${Number(result.tokensAdded || 0)}`)
      await Promise.all([load(), refreshUser()])
    } catch {
      setStatus(locale === 'ru' ? 'Не удалось перевести баланс в токены.' : 'Could not convert the balance to Tokens.')
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return <p className="pb-4 text-sm text-muted-foreground">{status || (locale === 'ru' ? 'Загрузка…' : 'Loading…')}</p>
  }

  return (
    <div className="pb-3">
      <div className="rounded-3xl border border-banana/30 bg-banana/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-banana text-[#171A22]"><Gift className="size-5" /></span>
          <div>
            <p className="text-base font-semibold">{t('referral.intro')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{locale === 'ru' ? 'Комиссия начисляется с успешных покупок приглашённых пользователей.' : 'Commission is credited from successful purchases by referred users.'}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          [t('referral.balance'), `${data.availableRub.toFixed(2)} ₽`],
          [t('referral.pending'), `${data.pendingRub.toFixed(2)} ₽`],
          [t('referral.invited'), String(data.invitedCount)],
          [t('referral.earned'), `${data.totalEarnedRub.toFixed(2)} ₽`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border p-3">
            <p className="text-lg font-semibold tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border p-4">
        <p className="text-xs font-medium text-muted-foreground">{t('referral.link')}</p>
        <p className="mt-2 break-all text-sm font-medium">{data.referralLink || data.referralCode}</p>
        <button type="button" disabled={!data.referralLink} onClick={() => void copyLink()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground text-xs font-semibold text-background disabled:opacity-40">
          <Copy className="size-4" />{t('referral.copy')}
        </button>
      </div>

      <button type="button" disabled={data.availableRub <= 0 || busy} onClick={() => void convertAll()} className="brand-gradient mt-3 h-11 w-full rounded-full text-sm font-semibold text-white disabled:opacity-40">
        {busy ? (locale === 'ru' ? 'Перевожу…' : 'Converting…') : t('referral.convertAll')}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">{locale === 'ru' ? 'Вывод рублей подключим отдельно после настройки выплат и проверки реквизитов.' : 'Cash withdrawals will be enabled separately after payout verification is configured.'}</p>
      {status && <p className="mt-3 text-center text-xs text-brand">{status}</p>}
    </div>
  )
}
