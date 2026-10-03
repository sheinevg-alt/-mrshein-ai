'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

export default function PaymentLaunchPage() {
  const [message, setMessage] = useState('Подготавливаем оплату…')

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('order') || ''
    if (!orderId) {
      setMessage('Не удалось открыть оплату.')
      return
    }

    let stopped = false
    let attempts = 0

    async function check() {
      if (stopped) return
      attempts += 1

      try {
        const response = await fetch('/api/payments/tochka/launch-status?order=' + encodeURIComponent(orderId), {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)

        if (data?.ready && data?.paymentLink) {
          window.location.replace(data.paymentLink)
          return
        }

        if (data?.failed || data?.expired) {
          setMessage('Не удалось создать платёж. Вернитесь в Banana Zero и попробуйте ещё раз.')
          return
        }
      } catch {}

      if (attempts >= 60) {
        setMessage('Платёж создаётся слишком долго. Вернитесь в Banana Zero и повторите попытку.')
        return
      }

      window.setTimeout(() => void check(), 500)
    }

    void check()
    return () => { stopped = true }
  }, [])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-7 text-center">
        <LoaderCircle className="mx-auto size-10 animate-spin text-brand" />
        <h1 className="mt-4 text-xl font-bold">Banana Zero</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  )
}
