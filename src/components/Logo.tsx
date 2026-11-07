import { MARCA } from '@/lib/marca'
import { cn } from '@/lib/utils'

/** Logo oficial (kit de marca). `branca` é a versão para fundo azul ou escuro. */
export function Logo({ small, branca, className }: { small?: boolean; branca?: boolean; className?: string }) {
  return <img src={branca ? MARCA.logoBranca : MARCA.logo} alt={MARCA.nome} className={cn('block w-auto shrink-0', small ? 'h-5' : 'h-7', className)} />
}
