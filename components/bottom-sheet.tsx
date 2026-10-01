'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useI18n } from './i18n-provider'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { t } = useI18n()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-t-3xl border border-b-0 bg-card shadow-[0_-12px_40px_-12px_oklch(0.3_0.08_260/0.25)] outline-none animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'calc(var(--app-safe-bottom) + 1.25rem)' }}
      >
        <div className="flex justify-center pt-2.5"><span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" /></div>
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition active:scale-95"
          >
            <X className="size-4" />
          </button>
        </div>
        <div data-bottom-sheet-scroll className="max-h-[78dvh] overflow-y-auto overscroll-contain px-5 pt-3 no-scrollbar">{children}</div>
      </div>
    </div>
  )
}
