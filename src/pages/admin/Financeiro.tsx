import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Info, Loader2, Lock, LockOpen, Send, Undo2 } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import type { StatusTx } from '@/lib/types'
import { CheckCircleFilled } from '@/components/icons'
import { StatusBadge } from '@/components/ui/badges'
import { Chip } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'

type Tx = { id: string; created_at: string; cliente: string; consultor: string; indicador: string; bruto: number; comissao: number; status: StatusTx }
type Total = { status: StatusTx; qtd: number; bruto: number; comissao: number }

const FILTROS: { k: StatusTx | 'todos'; label: string }[] = [
  { k: 'todos', label: 'Todos' },
  { k: 'verdinho', label: 'Verdinho' },
  { k: 'custodia', label: 'Em custódia' },
  { k: 'pendente', label: 'Pendente' },
  { k: 'repassado', label: 'Repassado' },
  { k: 'estornado', label: 'Estornado' },
]

export function Financeiro() {
  const qc = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<StatusTx | 'todos'>('todos')

  const totais = useQuery({
    queryKey: ['adm', 'totais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_totais')
      if (error) throw error
      const m = new Map(((data ?? []) as Total[]).map((t) => [t.status, { ...t, bruto: Number(t.bruto), comissao: Number(t.comissao), qtd: Number(t.qtd) }]))
      const g = (s: StatusTx) => m.get(s) ?? { status: s, qtd: 0, bruto: 0, comissao: 0 }
      return { custodia: g('custodia'), verdinho: g('verdinho'), estornado: g('estornado'), repassado: g('repassado') }
    },
  })
  const tx = useQuery({
    queryKey: ['adm', 'tx'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_transacoes')
      if (error) throw error
      return ((data ?? []) as Tx[]).map((t) => ({ ...t, bruto: Number(t.bruto), comissao: Number(t.comissao) }))
    },
  })

  const liberar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('liberar_comissao', { p_transacao: id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adm'] })
      toast('Comissão repassada ao indicador via Pix.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const linhas = (tx.data ?? []).filter((t) => filtro === 'todos' || t.status === filtro)

  const exportar = () => {
    const cab = ['id', 'data', 'cliente', 'consultor', 'indicador', 'bruto', 'comissao_indicador', 'status']
    const csv = [cab, ...linhas.map((t) => [t.id, new Date(t.created_at).toLocaleDateString('pt-BR'), t.cliente, t.consultor, t.indicador, t.bruto.toFixed(2).replace('.', ','), t.comissao.toFixed(2).replace('.', ','), t.status])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `indikei-transacoes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const t = totais.data
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-ink-600 first-letter:uppercase">{mes}</div>
          <h1 className="m-0 mt-1 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Financeiro e custódia</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
          <Download size={18} />
          Exportar CSV
        </Button>
      </div>

      {totais.error ? (
        <ErroBox erro={totais.error} onRetry={() => totais.refetch()} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <Kpi tom="ambar" icon={<Lock size={17} strokeWidth={2.6} />} rotulo="Em custódia" valor={t ? brl(t.custodia.bruto) : '…'} sub={`${t?.custodia.qtd ?? 0} aguardando entrevista`} />
          <div className="flex flex-col gap-2 rounded-[18px] bg-verde-600 p-5 text-white">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-verde-100">
              <CheckCircleFilled size={18} />
              Liberados (Verdinho)
            </span>
            <span className="text-[30px] font-extrabold tracking-[-0.03em]">{t ? brl(t.verdinho.comissao) : '…'}</span>
            <span className="text-[12px] font-semibold text-verde-100">{t?.verdinho.qtd ?? 0} comissões prontas para repasse</span>
          </div>
          <Kpi tom="vermelho" icon={<Undo2 size={17} />} rotulo="Estornados" valor={t ? brl(t.estornado.bruto) : '…'} sub="100% devolvido ao cliente" />
          <Kpi tom="ink" icon={<Send size={17} />} rotulo="Repassados" valor={t ? brl(t.repassado.comissao) : '…'} sub="comissões pagas via Pix" />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3.5">
          <span className="mr-2 text-[16px] font-extrabold">Transações</span>
          {FILTROS.map((f) => (
            <Chip key={f.k} active={filtro === f.k} onClick={() => setFiltro(f.k)} className="inline-flex h-8 items-center rounded-full px-3 text-[13px]">
              {f.label}
            </Chip>
          ))}
        </div>
        {tx.isLoading ? (
          <Carregando />
        ) : tx.error ? (
          <div className="p-4">
            <ErroBox erro={tx.error} onRetry={() => tx.refetch()} />
          </div>
        ) : !linhas.length ? (
          <div className="p-4">
            <Vazio titulo="Nenhuma transação com esse status" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px_104px_124px_136px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
                <span>ID · data</span>
                <span>Cliente</span>
                <span>Consultor</span>
                <span>Indicador</span>
                <span className="text-right">Bruto</span>
                <span className="text-right">Indicador 50%</span>
                <span>Status</span>
                <span />
              </div>
              {linhas.slice(0, 200).map((r) => {
                const pode = r.status === 'verdinho'
                return (
                  <div key={r.id} className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px_104px_124px_136px] items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
                    <div>
                      <div className="font-mono text-[12px] font-semibold">TX-{r.id.slice(0, 5).toUpperCase()}</div>
                      <div className="text-[12px] text-ink-400">{new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <span className="truncate font-bold">{r.cliente}</span>
                    <span className="truncate">{r.consultor}</span>
                    <span className="truncate">{r.indicador}</span>
                    <span className="text-right font-semibold">{brl(r.bruto)}</span>
                    <span className={cn('text-right font-extrabold', r.status === 'estornado' && 'text-ink-400 line-through')}>{brl(r.comissao)}</span>
                    <StatusBadge status={r.status} size="md" label={r.status === 'repassado' ? 'Repassado' : undefined} />
                    <button
                      type="button"
                      disabled={!pode || liberar.isPending}
                      onClick={() => liberar.mutate(r.id)}
                      title={pode ? 'Repassar ao indicador via Pix' : 'Disponível só quando o status é Verdinho'}
                      className={cn(
                        'flex h-[34px] items-center justify-center gap-1 rounded-[10px] text-[12px] font-extrabold',
                        pode ? 'cursor-pointer bg-verde-600 text-white hover:bg-verde-700' : 'cursor-not-allowed bg-ink-100 text-ink-400',
                      )}
                    >
                      {liberar.isPending && liberar.variables === r.id ? <Loader2 size={15} className="animate-spin" /> : <LockOpen size={15} />}
                      {r.status === 'repassado' ? 'Liberada' : 'Liberar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {linhas.length > 200 && <div className="border-t border-ink-100 px-5 py-3 text-[12px] text-ink-600">Mostrando 200 de {linhas.length}. Use os filtros ou exporte o CSV para ver tudo.</div>}
      </Card>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-400">
        <Info size={15} />
        "Liberar comissão" só fica disponível quando o status é Verdinho (entrevista de saúde aprovada pela Administradora).
      </div>
    </>
  )
}

function Kpi({ tom, icon, rotulo, valor, sub }: { tom: 'ambar' | 'vermelho' | 'ink'; icon: ReactNode; rotulo: string; valor: string; sub: string }) {
  const cor = { ambar: 'text-ambar-fg', vermelho: 'text-vermelho-fg', ink: 'text-ink-800' }[tom]
  return (
    <Card className="flex flex-col gap-2 p-5">
      <span className={cn('flex items-center gap-1.5 text-[13px] font-bold', cor)}>
        {icon}
        {rotulo}
      </span>
      <span className="text-[30px] font-extrabold tracking-[-0.03em]">{valor}</span>
      <span className="text-[12px] font-semibold text-ink-600">{sub}</span>
    </Card>
  )
}
