import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-full bg-white shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5',
        className,
      )}
    >
      <Image
        src="/banana-zero-cake.jpg"
        alt="Banana Zero logo"
        fill
        sizes="48px"
        priority
        className="object-cover"
      />
    </span>
  )
}
