'use client'

import { useMemo, useState } from 'react'
import { CreditCard, QrCode, ShieldCheck } from 'lucide-react'

const PACKS = [
  { tokens: 300, rub: 300, label: '300 токенов' },
  { tokens: 560, rub: 560, label: '560 токенов', featured: true },
  { tokens: 1000, rub: 1000, label: '1 000 токенов' },
]

export function PaymentForm({ enabled }: { enabled: boolean }) {
  const [selected, setSelected] = useState(560)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pack = useMemo(() => PACKS.find((item) => item.tokens === selected) || PACKS[1], [selected])

  async function checkout() {
    setError('')
    if (!email.includes('@')) {
      setError('Укажите email — он нужен для электронного чека.')
      return
    }
    if (!enabled) {
      setError('Рублёвая оплата пока в режиме подготовки. Эквайринг Точка будет включён после выдачи API-доступа.')
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
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {PACKS.map((item) => (
          <button
            key={item.tokens}
            type="button"
            onClick={() => setSelected(item.tokens)}
            className={`rounded-3xl border p-4 text-left transition ${selected === item.tokens ? 'border-brand bg-brand-tint shadow-sm' : 'bg-card'}`}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-2xl font-bold">{item.rub} ₽</p>
            {item.featured && <p className="mt-1 text-xs text-brand">Подходит для Birthday Drive</p>}
          </button>
        ))}
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
        {busy ? 'Создаём платёж…' : `Оплатить ${pack.rub} ₽`}
      </button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">1 Shein Token = 1 ₽. После подтверждения оплаты токены зачисляются на аккаунт.</p>
    </div>
  )
}
