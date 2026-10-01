import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[linear-gradient(145deg,#ffe66d_0%,#ffc928_48%,#f3a712_100%)] shadow-[0_8px_22px_-12px_rgba(139,92,0,0.55)]',
        className,
      )}
      aria-label="Banana Zero"
    >
      <span className="absolute inset-[3px] rounded-full border border-white/55" aria-hidden="true" />
      <span className="relative -ml-px text-[11px] font-black tracking-[-0.08em] text-[#211a09]" aria-hidden="true">BZ</span>
    </span>
  )
}
