import { cn } from '@/lib/utils'

// Espaço reservado: a logo definitiva (verde e azul) ainda não existe. Quando chegar, troque o
// quadrado tracejado pela imagem aqui, em `logo()` de src/pages/indicador/artes.ts e em public/favicon.svg.
export function Logo({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-extrabold tracking-[-0.04em] text-ink-950', small ? 'text-[18px]' : 'text-[22px]', className)}>
      <LogoReservada small={small} />
      Geralindica
    </span>
  )
}

export function LogoReservada({ small, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      title="Espaço reservado para a logo"
      className={cn(
        'grid shrink-0 place-items-center rounded-[8px] border-[1.5px] border-dashed border-current text-[8px] font-bold uppercase leading-none tracking-[.06em] opacity-60',
        small ? 'size-6' : 'size-7',
        className,
      )}
    >
      logo
    </span>
  )
}
