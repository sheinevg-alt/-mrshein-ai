'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, RotateCw } from 'lucide-react'

type PaymentState = {
  status: string
  tokenAmount: number
  amountRub: number
}

export function WebTestPaymentSuccess({
  orderId,
  failedRedirect,
}: {
  orderId: string
  failedRedirect: boolean
}) {
  const [state, setState] = useState<PaymentState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId || failedRedirect) return
    let cancelled = false
    let timer: number | undefined

    async function sync() {
      try {
        const response = await fetch(
          '/api/payments/tochka/status?order=' + encodeURIComponent(orderId),
          { cache: 'no-store' },
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || 'Не удалось проверить платёж')
        if (cancelled) return

        setState(data)
        setError('')

        if (data.status === 'pending' || data.status === 'waiting_for_capture') {
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
  }, [failedRedirect, orderId])

  const succeeded = state?.status === 'succeeded'
  const failed = failedRedirect || Boolean(state && ['failed', 'canceled', 'refunded'].includes(state.status))

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-lg rounded-4xl p-7 text-center">
        {succeeded ? (
          <>
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
            <h1 className="mt-4 text-3xl font-bold">Веб-платёж прошёл</h1>
            <p className="mt-3 text-lg font-semibold">
              {state.amountRub.toLocaleString('ru-RU')} ₽ · +{state.tokenAmount.toLocaleString('ru-RU')} Tokens
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Тест оплаты с обычного сайта Banana Zero успешно завершён. Эта страница остаётся на сайте и не переводит в Telegram.
            </p>
          </>
        ) : failed ? (
          <>
            <RotateCw className="mx-auto size-12 text-destructive" />
            <h1 className="mt-4 text-3xl font-bold">Платёж не завершён</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Точка не подтвердила оплату. Можно вернуться по закрытой тестовой ссылке и повторить попытку.
            </p>
          </>
        ) : (
          <>
            <Clock3 className="mx-auto size-12 text-brand" />
            <h1 className="mt-4 text-3xl font-bold">Подтверждаем веб-платёж</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Ждём подтверждение от Точки. Статус обновится автоматически.
            </p>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>
    </main>
  )
}
