import type { ReactNode } from 'react'
import { Clock, Thermometer, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckCircleFilled } from '@/components/icons'
import { STATUS_VENDA, faixaTemperatura } from '@/lib/negocio'
import type { StatusVenda } from '@/lib/types'

/** Verdinho é o único badge sólido verde (com ícone preenchido). */
export function VerdinhoBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-verde-600 py-[3px] pl-2 pr-[10px] text-[12px] font-bold text-white', className)}>
      <CheckCircleFilled size={14} />
      Verdinho ✓
    </span>
  )
}

const statusIcon: Record<StatusVenda, ReactNode> = {
  aguardando_entrevista: <Clock size={13} strokeWidth={2.5} />,
  aprovado: <CheckCircleFilled size={13} />,
  reprovado: <Undo2 size={13} strokeWidth={2.5} />,
}

/** Badge do status da venda registrada pelo consultor. */
export function StatusBadge({ status, size = 'sm', label }: { status: StatusVenda; size?: 'sm' | 'md'; label?: string }) {
  const s = STATUS_VENDA[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold',
        size === 'sm' ? 'py-0.5 pl-[7px] pr-[9px] text-[11px]' : 'py-[3px] pl-2 pr-[10px] text-[12px]',
      )}
      style={{ background: s.bg, color: s.fg }}
    >
      {statusIcon[status]}
      {label ?? s.label}
    </span>
  )
}

/** Temperatura (reputação) do consultor: número de 0 a 100 + faixa Fria/Morna/Quente. */
export function TemperaturaBadge({ valor, small }: { valor: number; small?: boolean }) {
  const f = faixaTemperatura(valor)
  return (
    <span
      title="Temperatura: reputação do consultor (vendas registradas, avaliações e vendas recentes)"
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold', small ? 'px-[9px] py-0.5 text-[11px]' : 'px-[10px] py-[3px] text-[12px]')}
      style={{ background: f.bg, color: f.fg }}
    >
      <Thermometer size={small ? 12 : 14} strokeWidth={2.5} />
      {valor}° · {f.label}
    </span>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('rounded-full px-[10px] py-[3px] text-[12px] font-bold', className)}>{children}</span>
}

export function HotBadge({ small }: { small?: boolean }) {
  return <Pill className={cn('bg-laranja-bg text-laranja-fg', small && 'px-[9px] py-0.5 text-[11px]')}>🔥 Em alta</Pill>
}

export function TopBadge({ small }: { small?: boolean }) {
  return <Pill className={cn('bg-ink-950 text-white', small && 'px-[9px] py-0.5 text-[11px]')}>Top 10</Pill>
}

export function GovBadge({ assinado }: { assinado: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 justify-self-start whitespace-nowrap rounded-full px-[10px] py-[3px] text-[12px] font-bold',
        assinado ? 'bg-azul-bg text-azul-fg' : 'bg-ambar-bg text-ambar-fg',
      )}
    >
      {assinado ? '✓ Assinado' : '⏳ Pendente'}
    </span>
  )
}

export function AtivoBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 justify-self-start rounded-full px-[10px] py-[3px] text-[12px] font-bold',
        ativo ? 'bg-verde-50 text-verde-700' : 'bg-ink-100 text-ink-400',
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}
