import type { Consultor } from '@/lib/types'
import { cn } from '@/lib/utils'

export function VagasBar({ c, size = 'sm' }: { c: Consultor; size?: 'sm' | 'lg' }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={c.max_indicadores}
      aria-valuenow={c.ocupacao}
      aria-label={`${c.ocupacao} de ${c.max_indicadores} vagas ocupadas`}
      className={cn('overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1.5' : 'h-2.5')}
    >
      <div className="h-full" style={{ width: `${c.pct}%`, background: c.barColor }} />
    </div>
  )
}
