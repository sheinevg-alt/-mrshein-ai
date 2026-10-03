'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react'
import { TOKEN_PURCHASE_MAX, TOKEN_PURCHASE_MIN, TOKEN_PURCHASE_STEP, getTokenPurchaseQuote, normalizeTokenPurchaseAmount } from '@/lib/public-pricing'
import { getTelegramInitData } from '@/lib/telegram'

export function PaymentForm({ enabled, initialTokens = 500, testModeRequested = false }: { enabled: boolean; initialTokens?: number; testModeRequested?: boolean }) {
  const router = useRouter()
  const [tokenAmount, setTokenAmount] = useState(normalizeTokenPurchaseAmount(initialTokens))
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testCheckout, setTestCheckout] = useState<{ enabled: boolean; amountRub: number; tokenAmount: number } | null>(null)
  const [error, setError] = useState('')
  const [preparingPayment, setPreparingPayment] = useState(false)
  const [preparedPayment, setPreparedPayment] = useState<{ key: string; orderId: string; paymentLink: string } | null>(null)

  const isTestMode = testModeRequested && testCheckout?.enabled === true
  const pack = isTestMode
    ? {
        tokens: testCheckout.tokenAmount,
        regularRub: testCheckout.amountRub,
        priceRub: testCheckout.amountRub,
        savingsRub: 0,
        discountPct: 0,
      }
    : getTokenPurchaseQuote(tokenAmount)

  const checkoutKey = [
    isTestMode ? 'test' : 'regular',
    String(pack.tokens),
    email.trim().toLowerCase(),
    name.trim(),
  ].join('|')

  useEffect(() => {
    setPreparedPayment(null)

    if (!enabled || !accepted || !email.includes('@')) {
      setPreparingPayment(false)
      return
    }
    if (testModeRequested && !testCheckout?.enabled) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setPreparingPayment(true)
        setError('')
        const orderId = crypto.randomUUID()

        try {
          const response = await fetch('/api/payments/tochka/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': getTelegramInitData(),
            },
            body: JSON.stringify({
              orderId,
              tokenAmount: isTestMode ? (testCheckout?.tokenAmount || 100) : pack.tokens,
              email,
              name,
              testPayment: isTestMode,
            }),
          })
          const data = await response.json()
          if (!response.ok || !data?.paymentLink || !data?.orderId) {
            throw new Error(data?.error || 'Не удалось подготовить платёж')
          }
          if (!cancelled) {
            setPreparedPayment({
              key: checkoutKey,
              orderId: data.orderId,
              paymentLink: data.paymentLink,
            })
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : 'Не удалось подготовить платёж')
          }
        } finally {
          if (!cancelled) setPreparingPayment(false)
        }
      })()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    accepted,
    checkoutKey,
    email,
    enabled,
    isTestMode,
    name,
    pack.tokens,
    testCheckout?.enabled,
    testCheckout?.tokenAmount,
    testModeRequested,
  ])


  useEffect(() => {
    const initData = getTelegramInitData()
    if (!initData) return

    void fetch('/api/payments/tochka/test-access', {
      headers: { 'X-Telegram-Init-Data': initData },
      cache: 'no-store',
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.enabled) {
          const nextTestCheckout = {
            enabled: true,
            amountRub: Number(data.amountRub || 100),
            tokenAmount: Number(data.tokenAmount || 100),
          }
          setTestCheckout(nextTestCheckout)
          if (testModeRequested) setTokenAmount(nextTestCheckout.tokenAmount)
        }
      })
      .catch(() => undefined)
  }, [testModeRequested])

  useEffect(() => {
    let checking = false

    async function syncPendingPayment() {
      if (checking || document.visibilityState !== 'visible') return
      const orderId = window.sessionStorage.getItem('banana-zero.pending-payment') || ''
      if (!orderId) return

      checking = true
      try {
        const response = await fetch('/api/payments/tochka/status?order=' + encodeURIComponent(orderId), {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || !data) return

        if (data.status === 'succeeded') {
          window.sessionStorage.removeItem('banana-zero.pending-payment')
          router.replace('/app?tab=profile&payment=' + encodeURIComponent(orderId))
          return
        }

        if (['failed', 'canceled', 'refunded'].includes(data.status)) {
          window.sessionStorage.removeItem('banana-zero.pending-payment')
        }
      } finally {
        checking = false
      }
    }

    const onResume = () => {
      if (document.visibilityState === 'visible') void syncPendingPayment()
    }

    void syncPendingPayment()
    const timer = window.setInterval(() => void syncPendingPayment(), 2000)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    document.addEventListener('visibilitychange', onResume)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      document.removeEventListener('visibilitychange', onResume)
    }
  }, [router])

  function markPaymentOpened() {
    if (!preparedPayment || preparedPayment.key !== checkoutKey) return
    window.sessionStorage.setItem('banana-zero.pending-payment', preparedPayment.orderId)
  }

  return (
    <div className="space-y-5" id="tokens">
      <div>
        <p className="text-sm font-semibold">{isTestMode ? 'Тестовый платёж' : 'Покупка Tokens'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isTestMode ? 'Тестовая покупка доступна только вашему аккаунту.' : 'Выберите количество Tokens и перейдите к оплате.'}
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-5">
        <div className="text-center">
          <p className="text-3xl font-black">{pack.tokens.toLocaleString('ru-RU')} Tokens</p>
          <div className="mt-1 flex items-center justify-center gap-2">
            {pack.discountPct > 0 && <span className="text-sm text-muted-foreground line-through">{pack.regularRub.toLocaleString('ru-RU')} ₽</span>}
            <span className="text-xl font-black">{pack.priceRub.toLocaleString('ru-RU')} ₽</span>
            {pack.discountPct > 0 && <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-black text-emerald-700">−{pack.discountPct}%</span>}
          </div>
          {pack.savingsRub > 0 && <p className="mt-1 text-xs font-medium text-emerald-700">Экономия {pack.savingsRub.toLocaleString('ru-RU')} ₽</p>}
        </div>
        {isTestMode ? (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/8 px-4 py-3 text-center text-xs font-semibold text-amber-700">
            Тестовый платёж · {pack.tokens.toLocaleString('ru-RU')} Tokens за {pack.priceRub.toLocaleString('ru-RU')} ₽
          </div>
        ) : (
          <>
            <input
              type="range"
              min={TOKEN_PURCHASE_MIN}
              max={TOKEN_PURCHASE_MAX}
              step={TOKEN_PURCHASE_STEP}
              value={tokenAmount}
              onChange={(event) => setTokenAmount(Number(event.target.value))}
              className="mt-5 w-full"
              aria-label="Количество Tokens"
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>200</span><span>1000</span><span>2000</span><span>3000</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
              <span className={tokenAmount >= 1000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>1000+ · −8%</span>
              <span className={tokenAmount >= 2000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>2000+ · −10%</span>
              <span className={tokenAmount >= 3000 ? 'rounded-full bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-muted px-2 py-1 text-muted-foreground'}>3000 · −13%</span>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Email для чека</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded-2xl border bg-card px-4 py-3 outline-none focus:border-brand" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Необязательно" className="mt-1 w-full rounded-2xl border bg-card px-4 py-3 outline-none focus:border-brand" />
        </label>
      </div>

      <div className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
        <span className="flex items-center gap-2"><CreditCard className="size-4 text-brand" />Банковская карта</span>
        <span className="flex items-center gap-2"><QrCode className="size-4 text-brand" />СБП</span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" />Электронный чек</span>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-xs leading-5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-black"
        />
        <span className="text-muted-foreground">
          Я соглашаюсь с{' '}
          <Link href="https://bananazero.ru/offer" target="_blank" className="font-medium text-foreground underline underline-offset-2">публичной офертой</Link>,{' '}
          <Link href="https://bananazero.ru/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">политикой конфиденциальности</Link>,{' '}
          <Link href="https://bananazero.ru/legal/service-delivery" target="_blank" className="font-medium text-foreground underline underline-offset-2">правилами оказания услуг</Link>{' '}
          и{' '}
          <Link href="https://bananazero.ru/pricing" target="_blank" className="font-medium text-foreground underline underline-offset-2">условиями тарифов и стоимости</Link>.
        </span>
      </label>

      {preparedPayment && preparedPayment.key === checkoutKey && !preparingPayment ? (
        <a
          href={'/pay/go?order=' + encodeURIComponent(preparedPayment.orderId)}
          onClick={markPaymentOpened}
          className="brand-gradient flex h-12 w-full items-center justify-center rounded-full font-semibold text-white"
        >
          {'Оплатить ' + pack.priceRub.toLocaleString('ru-RU') + ' ₽'}
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="brand-gradient h-12 w-full rounded-full font-semibold text-white opacity-50"
        >
          {preparingPayment ? 'Подготавливаем оплату…' : 'Готовим оплату…'}
        </button>
      )}

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">После подтверждения оплаты Tokens зачисляются на баланс Banana Zero.</p>
    </div>
  )
}
