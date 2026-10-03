'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTelegramBackButton } from '@/lib/telegram'

export function PayBackButton() {
  const router = useRouter()

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/app')
  }

  useTelegramBackButton(true, goBack)

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Назад"
      className="glass flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-95"
    >
      <ChevronLeft className="size-5" />
    </button>
  )
}
