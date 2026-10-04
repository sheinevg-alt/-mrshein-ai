'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, RotateCw } from 'lucide-react'

type PaymentState = {
  status: string
  tokenAmount: number
  amountRub: number
}

export function PaymentSuccess({
  orderId,
  webMode = false,
  failedRedirect = false,
}: {
  orderId: string
  webMode?: boolean
  failedRedirect?: boolean
}) {
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')
  const telegramUrl = useMemo(
    () => `tg://resolve?domain=BananaZeroBot&startapp=payment_${encodeURIComponent(orderId)}&mode=fullscreen`,
    [orderId],
  )

  useEffect(() => {
    if (!orderId || failedRedirect) return
    let cancelled = false
    let timer: number | undefined

    async function sync() {
      try {
        const response = await fetch(`/api/payments/tochka/status?order=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Не удалось проверить платёж')
        if (cancelled) return
        setState(data)
        setError('')

        if (data.status === 'succeeded') {
          if (!webMode) window.location.replace(telegramUrl)
        } else if (data.status === 'pending' || data.status === 'waiting_for_capture') {
          timer = window.setTimeout(() => void sync(), 1500)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось проверить платёж')
          timer = window.setTimeout(() => void sync(), 2500)
        }
      }
    }

    void sync()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [failedRedirect, orderId, telegramUrl, webMode])

  const succeeded = state?.status === 'succeeded'
  const failed = failedRedirect || Boolean(state && ['failed', 'canceled', 'refunded'].includes(state.status))

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-lg rounded-4xl p-7 text-center">
        {succeeded ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
            <h1 className="mt-4 text-3xl font-bold">Оплата прошла</h1>
            <p className="mt-3 text-lg font-semibold">+{state.tokenAmount.toLocaleString('ru-RU')} Tokens</p>
            {webMode ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Tokens уже зачислены. Вы вернулись в Banana Zero.
                </p>
                <a href="/app?tab=profile" className="brand-gradient mt-6 inline-flex h-11 items-center rounded-full px-5 font-semibold text-white">
                  Вернуться в Banana Zero
                </a>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Tokens уже зачислены. Открываем Banana Zero в Telegram.
                </p>
                <a href={telegramUrl} className="brand-gradient mt-6 inline-flex h-11 items-center rounded-full px-5 font-semibold text-white">
                  Открыть Banana Zero
                </a>
              </>
            )}
          </>
        ) : failed ? (
          <>
            <RotateCw className="mx-auto size-12 text-destructive" />
            <h1 className="mt-4 text-3xl font-bold">Платёж не завершён</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Оплата не была подтверждена. Можно вернуться в Banana Zero и повторить попытку.
            </p>
            <a
              href={webMode ? '/app?tab=profile' : 'tg://resolve?domain=BananaZeroBot&startapp&mode=fullscreen'}
              className="brand-gradient mt-6 inline-flex h-11 items-center rounded-full px-5 font-semibold text-white"
            >
              Вернуться в Banana Zero
            </a>
          </>
        ) : (
          <>
            <Clock3 className="mx-auto size-12 text-brand" />
            <h1 className="mt-4 text-3xl font-bold">Подтверждаем оплату</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Платёж уже завершён в банке. Ждём подтверждение от платёжной системы и автоматически зачислим Tokens.
            </p>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </main>
  )
}
