import type { ReactNode } from 'react'
import { Lock, ShieldCheck } from 'lucide-react'
import { brl, cn } from '@/lib/utils'
import { calcularSplit, mascararCPF, mascararTelefone, STATUS_TX, pct } from '@/lib/negocio'
import type { ExtratoItem } from '@/lib/types'
import { StatusBadge } from '@/components/ui/badges'
import { Logo } from '@/components/Logo'

export function Avatar({ nome, foto, size = 36, rounded = 'full', className }: { nome: string; foto?: string | null; size?: number; rounded?: 'full' | 'xl'; className?: string }) {
  const r = rounded === 'full' ? 'rounded-full' : 'rounded-[22px]'
  if (foto) return <img src={foto} alt="" style={{ width: size, height: size }} className={cn('shrink-0 bg-ink-100 object-cover', r, className)} />
  const ini = nome
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={cn('flex shrink-0 items-center justify-center bg-ink-950 font-extrabold text-white', r, className)}>
      {ini}
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[18px] border border-ink-200 bg-white', className)}>{children}</div>
}

export function TituloPagina({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {sub && <div className="text-[14px] font-semibold text-ink-600">{sub}</div>}
        <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.03em] sm:text-[28px]">{titulo}</h1>
      </div>
      {children}
    </div>
  )
}

/** Linha de extrato do indicador (dados do cliente já filtrados pela LGPD no banco). */
export function LinhaExtrato({ e, onClick, mostrarCanal }: { e: ExtratoItem; onClick: () => void; mostrarCanal?: boolean }) {
  const s = STATUS_TX[e.status]
  const cor = e.status === 'estornado' || e.status === 'pendente' ? '#8494A8' : e.status === 'custodia' ? '#4A5B70' : '#0B1A30'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-ink-100 bg-white px-4 py-[14px] text-left last:border-b-0 hover:bg-[#F9FAFC]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] font-extrabold" style={{ background: s.avBg, color: s.avFg }}>
        {e.primeiro_nome[0]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{e.primeiro_nome}</div>
        <div className="truncate text-[12px] text-ink-600">
          {new Date(e.data).toLocaleDateString('pt-BR')} · {mostrarCanal && e.canal ? e.canal : 'Plano de Saúde'}
        </div>
      </div>
      <div className="flex flex-col items-end gap-[5px]">
        <span className="text-[15px] font-extrabold" style={{ color: cor, textDecoration: e.status === 'estornado' ? 'line-through' : 'none' }}>
          {brl(e.comissao)}
        </span>
        <StatusBadge status={e.status} />
      </div>
    </button>
  )
}

/** Recibo visual do split: bruto → imposto → líquido → 50/50. */
export function ReciboSplit({ e, pctIndicador = 50 }: { e: ExtratoItem; pctIndicador?: number }) {
  const s = STATUS_TX[e.status]
  const r = calcularSplit(e.bruto, e.aliquota, pctIndicador)
  return (
    <>
      <Logo small className="text-[15px] text-ink-600 [&>img]:size-5" />
      <div className="flex items-center gap-3 rounded-[14px] bg-ink-50 p-3">
        <span className="flex size-10 items-center justify-center rounded-[12px] font-extrabold" style={{ background: s.avBg, color: s.avFg }}>
          {e.primeiro_nome[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{e.primeiro_nome}</div>
          <div className="truncate text-[12px] text-ink-600">
            {new Date(e.data).toLocaleDateString('pt-BR')} · {e.canal ?? 'canal não informado'}
          </div>
        </div>
        <StatusBadge status={e.status} size="md" />
      </div>
      <Linha k="Valor bruto da adesão" v={brl(r.bruto)} />
      <Linha k={`Imposto (${pct(e.aliquota)} ${e.aliquota > 20 ? 'PF' : 'Simples'})`} v={`− ${brl(r.imposto)}`} vermelho />
      <div className="border-t border-dashed border-ink-200" />
      <div className="flex justify-between text-[15px]">
        <span className="font-bold">Valor líquido</span>
        <span className="font-extrabold">{brl(r.liquido)}</span>
      </div>
      <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
        <div className="bg-verde-600" style={{ flex: pctIndicador }} />
        <div className="bg-ink-800" style={{ flex: 100 - pctIndicador }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[12px] bg-verde-50 p-3">
          <div className="text-[12px] font-bold text-verde-700">{pctIndicador}% Você</div>
          <div className="text-[20px] font-extrabold text-verde-900">{brl(r.indicador)}</div>
        </div>
        <div className="rounded-[12px] bg-ink-50 p-3">
          <div className="text-[12px] font-bold text-ink-600">{100 - pctIndicador}% Consultor + plataforma</div>
          <div className="text-[20px] font-extrabold">{brl(r.resto)}</div>
        </div>
      </div>
      <div className="rounded-[12px] px-3 py-2.5 text-[13px] leading-[1.5] text-ink-600" style={{ background: s.notaBg }}>
        {s.nota}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-ink-600">Dados do cliente</span>
        <CampoMascarado rotulo="CPF" valor={mascararCPF(e.cpf_final)} />
        <CampoMascarado rotulo="Telefone" valor={mascararTelefone(e.tel_final)} />
        <CampoMascarado rotulo="Saúde" valor="•••••••••••" />
        <SeloLGPD />
      </div>
    </>
  )
}

function Linha({ k, v, vermelho }: { k: string; v: string; vermelho?: boolean }) {
  return (
    <div className="flex justify-between text-[14px]">
      <span className="text-ink-600">{k}</span>
      <span className={cn('font-bold', vermelho && 'text-vermelho-fg')}>{v}</span>
    </div>
  )
}

/** CampoMascarado (LGPD): leitura apenas, com cadeado. */
export function CampoMascarado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-ink-200 bg-ink-50 px-3 py-[9px]">
      <span className="w-[72px] text-[12px] text-ink-600">{rotulo}</span>
      <span className="flex-1 font-mono text-[13px]">{valor}</span>
      <Lock size={15} className="text-ink-400" />
    </div>
  )
}

export function SeloLGPD() {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-1 text-[12px] font-semibold text-ink-400">
      <ShieldCheck size={15} />
      Dados protegidos pela LGPD
    </div>
  )
}

export function BarraFunil({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex justify-between text-[13px]">
        <span className="font-semibold text-ink-600">{label}</span>
        <span className="font-extrabold">{n.toLocaleString('pt-BR')}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink-50">
        <div className="h-full rounded-full" style={{ width: `${Math.max(3, total ? (n / total) * 100 : 0)}%`, background: color }} />
      </div>
    </div>
  )
}

/** Abas segmentadas (estilo PF/PJ, Funil/Recuperação). */
export function Segmentado<T extends string>({ opcoes, valor, onChange, className }: { opcoes: { v: T; label: ReactNode }[]; valor: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('flex rounded-[12px] bg-ink-100 p-1', className)} role="tablist">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          role="tab"
          aria-selected={valor === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 py-2 text-[13px] font-bold text-ink-950 sm:text-[14px]',
            valor === o.v ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'bg-transparent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
