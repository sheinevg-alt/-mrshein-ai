'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react'
import { TOKEN_PURCHASE_MAX, TOKEN_PURCHASE_MIN, TOKEN_PURCHASE_STEP, getTokenPurchaseQuote, normalizeTokenPurchaseAmount } from '@/lib/public-pricing'
import { getTelegramInitData, openExternalLink } from '@/lib/telegram'

export function PaymentForm({ enabled, initialTokens = 500 }: { enabled: boolean; initialTokens?: number }) {
  const router = useRouter()
  const [tokenAmount, setTokenAmount] = useState(normalizeTokenPurchaseAmount(initialTokens))
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingOrderId, setPendingOrderId] = useState('')
  const [waitingForPayment, setWaitingForPayment] = useState(false)
  const [paymentLink, setPaymentLink] = useState('')

  const pack = getTokenPurchaseQuote(tokenAmount)


  useEffect(() => {
    const stored = window.sessionStorage.getItem('banana-zero.pending-payment') || ''
    if (!stored) return

    try {
      const parsed = JSON.parse(stored)
      if (parsed?.orderId && parsed?.paymentLink) {
        setPendingOrderId(String(parsed.orderId))
        setPaymentLink(String(parsed.paymentLink))
        setWaitingForPayment(true)
        return
      }
    } catch {}

    window.sessionStorage.removeItem('banana-zero.pending-payment')
  }, [])

  useEffect(() => {
    if (!pendingOrderId) return

    let cancelled = false
    let checking = false

    async function checkPayment() {
      if (cancelled || checking) return
      checking = true
      try {
        const response = await fetch('/api/payments/tochka/status?order=' + encodeURIComponent(pendingOrderId), {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)
        if (cancelled || !response.ok || !data) return

        if (data.status === 'succeeded') {
          window.sessionStorage.removeItem('banana-zero.pending-payment')
          const completedOrderId = pendingOrderId
          setWaitingForPayment(false)
          setPaymentLink('')
          setPendingOrderId('')
          router.replace('/app?tab=profile&payment=' + encodeURIComponent(completedOrderId))
          return
        }

        if (['failed', 'canceled', 'refunded'].includes(data.status)) {
          window.sessionStorage.removeItem('banana-zero.pending-payment')
          setWaitingForPayment(false)
          setPaymentLink('')
          setPendingOrderId('')
          setError('Платёж не завершён. Можно повторить попытку.')
        }
      } finally {
        checking = false
      }
    }

    const onResume = () => {
      if (document.visibilityState === 'visible') void checkPayment()
    }

    void checkPayment()
    const timer = window.setInterval(() => void checkPayment(), 2000)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    document.addEventListener('visibilitychange', onResume)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      document.removeEventListener('visibilitychange', onResume)
    }
  }, [pendingOrderId, router])

  async function checkout() {
    setError('')
    if (!email.includes('@')) {
      setError('Укажите email — он нужен для электронного чека.')
      return
    }
    if (!accepted) {
      setError('Подтвердите согласие с условиями покупки.')
      return
    }
    if (!enabled) {
      setError('Рублёвая оплата временно недоступна.')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/payments/tochka/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': getTelegramInitData(),
        },
        body: JSON.stringify({ tokenAmount: pack.tokens, email, name }),
      })
      const data = await response.json()
      if (!response.ok || !data?.paymentLink || !data?.orderId) throw new Error(data?.error || 'Не удалось создать платёж')
      setPendingOrderId(data.orderId)
      setPaymentLink(data.paymentLink)
      setWaitingForPayment(true)
      window.sessionStorage.setItem('banana-zero.pending-payment', JSON.stringify({
        orderId: data.orderId,
        paymentLink: data.paymentLink,
      }))
      openExternalLink(data.paymentLink)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать платёж')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5" id="tokens">
      <div>
        <p className="text-sm font-semibold">Покупка Tokens</p>
        <p className="mt-1 text-xs text-muted-foreground">Выберите количество Tokens и перейдите к оплате.</p>
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

      {waitingForPayment && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6">
          <p className="font-semibold text-emerald-700">Ожидаем подтверждение оплаты</p>
          <p className="mt-1 text-xs text-muted-foreground">Если страница оплаты не открылась автоматически, нажмите кнопку ниже.</p>
          {paymentLink && (
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-semibold text-background"
            >
              Перейти к оплате
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.removeItem('banana-zero.pending-payment')
              setPendingOrderId('')
              setPaymentLink('')
              setWaitingForPayment(false)
            }}
            className="mt-3 w-full text-center text-xs font-medium text-muted-foreground underline underline-offset-4"
          >
            Отменить эту попытку
          </button>
        </div>
      )}

      <button type="button" onClick={() => void checkout()} disabled={busy || waitingForPayment} className="brand-gradient h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">
        {busy ? 'Создаём платёж…' : waitingForPayment ? 'Проверяем оплату…' : 'Оплатить ' + pack.priceRub.toLocaleString('ru-RU') + ' ₽'}
      </button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">После подтверждения оплаты Tokens зачисляются на баланс Banana Zero автоматически.</p>
    </div>
  )
}
