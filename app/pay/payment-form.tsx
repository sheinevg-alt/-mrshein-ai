'use client'

import { useMemo, useState } from 'react'
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react'
import { PUBLIC_TOKEN_PACKS } from '@/lib/public-pricing'

export function PaymentForm({ enabled, initialTokens = 500 }: { enabled: boolean; initialTokens?: number }) {
  const initialIndex = Math.max(0, PUBLIC_TOKEN_PACKS.findIndex((item) => item.tokens === initialTokens))
  const [packIndex, setPackIndex] = useState(initialIndex)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pack = useMemo(() => PUBLIC_TOKEN_PACKS[packIndex] || PUBLIC_TOKEN_PACKS[1], [packIndex])

  async function checkout() {
    setError('')
    if (!email.includes('@')) {
      setError('Укажите email — он нужен для электронного чека.')
      return
    }
    if (!enabled) {
      setError('Рублёвая оплата временно недоступна. Тарифы и стоимость услуг уже опубликованы на сайте.')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/payments/tochka/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAmount: pack.tokens, email, name }),
      })
      const data = await response.json()
      if (!response.ok || !data?.paymentLink) throw new Error(data?.error || 'Не удалось создать платёж')
      window.location.href = data.paymentLink
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать платёж')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5" id="tokens">
      <div>
        <p className="text-sm font-semibold">Разовая покупка Tokens</p>
        <p className="mt-1 text-xs text-muted-foreground">Без тарифа и без подписки. Выберите количество Tokens бегунком.</p>
      </div>

      <div className="rounded-3xl border bg-card p-5">
        <div className="text-center">
          <p className="text-3xl font-black">{pack.tokens.toLocaleString('ru-RU')} Tokens</p>
          <p className="mt-1 text-xl font-semibold">{pack.priceRub.toLocaleString('ru-RU')} ₽</p>
        </div>
        <input
          type="range"
          min={0}
          max={PUBLIC_TOKEN_PACKS.length - 1}
          step={1}
          value={packIndex}
          onChange={(event) => setPackIndex(Number(event.target.value))}
          className="mt-5 w-full"
          aria-label="Количество Tokens"
        />
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {PUBLIC_TOKEN_PACKS.map((item) => <span key={item.tokens}>{item.tokens}</span>)}
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

      <button type="button" onClick={() => void checkout()} disabled={busy} className="brand-gradient h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">
        {busy ? 'Создаём платёж…' : `Оплатить ${pack.priceRub.toLocaleString('ru-RU')} ₽`}
      </button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">После подтверждения оплаты Tokens зачисляются на баланс Banana Zero.</p>
    </div>
  )
}
