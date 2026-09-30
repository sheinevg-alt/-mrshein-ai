import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-full bg-white shadow-[0_6px_18px_-10px_oklch(0.5_0.21_264/0.45)]',
        className,
      )}
    >
      <Image
        src="/mrshein-ai-logo.png"
        alt="Shein AI logo"
        fill
        sizes="48px"
        priority
        className="object-cover"
      />
    </span>
  )
}
