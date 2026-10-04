'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react'

export function WebTestPaymentForm({
  accessKey,
  amountRub,
  tokenAmount,
}: {
  accessKey: string
  amountRub: number
  tokenAmount: number
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function startPayment() {
    if (loading) return
    if (!email.includes('@')) {
      setError('Укажите корректный email для электронного чека.')
      return
    }
    if (!accepted) {
      setError('Нужно принять условия оплаты.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/payments/tochka/web-test/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey,
          email,
          name,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.paymentLink) {
        throw new Error(data?.error || 'Не удалось создать платёж')
      }
      window.location.assign(String(data.paymentLink))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать платёж')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700">
          Web test only
        </div>
        <h2 className="mt-3 text-2xl font-black">Тестовый платёж {amountRub.toLocaleString('ru-RU')} ₽</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Проверяем оплату именно через обычный сайт Banana Zero. Telegram для запуска этого платежа не используется.
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-5 text-center">
        <p className="text-3xl font-black">{amountRub.toLocaleString('ru-RU')} ₽</p>
        <p className="mt-2 text-sm font-semibold">{tokenAmount.toLocaleString('ru-RU')} Tokens</p>
        <p className="mt-1 text-xs text-muted-foreground">Тестовая покупка через эквайринг Точки</p>
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Email для чека</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-2xl border bg-card px-4 py-3 outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Имя</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            placeholder="Необязательно"
            className="mt-1 w-full rounded-2xl border bg-card px-4 py-3 outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="grid gap-2 rounded-2xl bg-muted/60 p-4 text-sm sm:grid-cols-3">
        <span className="flex items-center gap-2"><CreditCard className="size-4 text-brand" />Карта</span>
        <span className="flex items-center gap-2"><QrCode className="size-4 text-brand" />СБП</span>
        <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" />Чек</span>
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
          <Link href="/offer" target="_blank" className="font-medium text-foreground underline underline-offset-2">публичной офертой</Link>,{' '}
          <Link href="/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">политикой конфиденциальности</Link>{' '}
          и условиями тестовой оплаты.
        </span>
      </label>

      <button
        type="button"
        onClick={startPayment}
        disabled={loading}
        className="brand-gradient h-12 w-full rounded-full font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'Переходим к оплате…' : `Оплатить ${amountRub.toLocaleString('ru-RU')} ₽`}
      </button>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs leading-5 text-muted-foreground">
        После оплаты Точка вернёт вас обратно на сайт Banana Zero, где мы проверим подтверждение платежа.
      </p>
    </div>
  )
}
