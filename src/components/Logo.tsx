import { MARCA } from '@/lib/marca'
import { cn } from '@/lib/utils'

// Símbolo vem de public/marca.svg (hoje um espaço reservado; a logo definitiva será verde e azul).
export function Logo({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-extrabold tracking-[-0.04em] text-ink-950', small ? 'text-[18px]' : 'text-[22px]', className)}>
      <img src={MARCA.simbolo} alt="" aria-hidden className={cn('shrink-0 rounded-[8px]', small ? 'size-6' : 'size-7')} />
      {MARCA.nome}
    </span>
  )
}
