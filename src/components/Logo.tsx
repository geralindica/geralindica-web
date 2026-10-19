import { cn } from '@/lib/utils'

export function Logo({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-[2px] font-extrabold tracking-[-0.045em] text-ink-950', small ? 'text-[20px]' : 'text-[24px]', className)}>
      indikei
      <span className={cn('inline-block rounded-full bg-verde-600', small ? 'size-1.5' : 'size-[7px]')} />
    </span>
  )
}
