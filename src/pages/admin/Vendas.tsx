import type { ReactNode } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Download, Info, Thermometer, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import { STATUS_VENDA, dataBR, faixaTemperatura } from '@/lib/negocio'
import type { StatusVenda } from '@/lib/types'
import { CheckCircleFilled } from '@/components/icons'
import { StatusBadge, TemperaturaBadge } from '@/components/ui/badges'
import { Chip } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio } from '@/components/ui/feedback'

type LinhaVenda = { id: string; data_venda: string; created_at: string; cliente: string; consultor: string; indicador: string; valor_adesao: number; aliquota: number; bonificacao_pct: number | null; estimativa_indicador: number; estimativa_geralindica: number | null; status: StatusVenda }
type ConsultorTemp = { id: string; nome_exibicao: string; temperatura: number; vendas: number; vendas_30d: number; ocupacao: number; max_indicadores: number; publicado: boolean }

const FILTROS: { k: StatusVenda | 'todos'; label: string }[] = [
  { k: 'todos', label: 'Todas' },
  { k: 'aprovado', label: 'Verdinho' },
  { k: 'aguardando_entrevista', label: 'Aguardando entrevista' },
  { k: 'reprovado', label: 'Reprovadas' },
]

/** Admin só acompanha: vendas que os consultores registraram e a temperatura de cada um. Nada é aprovado aqui. */
export function Vendas() {
  const [filtro, setFiltro] = useState<StatusVenda | 'todos'>('todos')

  const vendas = useQuery({
    queryKey: ['adm', 'vendas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_vendas')
      if (error) throw error
      return ((data ?? []) as LinhaVenda[]).map((v) => ({
        ...v,
        valor_adesao: Number(v.valor_adesao),
        aliquota: Number(v.aliquota),
        bonificacao_pct: v.bonificacao_pct == null ? null : Number(v.bonificacao_pct),
        estimativa_indicador: Number(v.estimativa_indicador),
        estimativa_geralindica: v.estimativa_geralindica == null ? null : Number(v.estimativa_geralindica),
      }))
    },
  })
  const consultores = useQuery({
    queryKey: ['adm', 'temperatura'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultores')
        .select('id, nome_exibicao, temperatura, vendas, vendas_30d, ocupacao, max_indicadores, publicado')
        .order('temperatura', { ascending: false })
      if (error) throw error
      return (data ?? []) as ConsultorTemp[]
    },
  })

  const todas = vendas.data ?? []
  const linhas = todas.filter((v) => filtro === 'todos' || v.status === filtro)
  const soma = (st: StatusVenda) => todas.filter((v) => v.status === st)
  const aprovadas = soma('aprovado')
  const aguardando = soma('aguardando_entrevista')
  const reprovadas = soma('reprovado')

  const exportar = () => {
    const cab = ['id', 'data_venda', 'registrada_em', 'cliente', 'consultor', 'indicador', 'valor_adesao', 'imposto_consultor_pct', 'bonificacao_pct', 'estimativa_indicador', 'estimativa_geralindica', 'status']
    const csv = [
      cab,
      ...linhas.map((v) => [v.id, dataBR(v.data_venda + 'T12:00'), dataBR(v.created_at), v.cliente, v.consultor, v.indicador, dec(v.valor_adesao), dec(v.aliquota), v.bonificacao_pct == null ? '' : dec(v.bonificacao_pct), dec(v.estimativa_indicador), v.estimativa_geralindica == null ? '' : dec(v.estimativa_geralindica), STATUS_VENDA[v.status].label]),
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `geralindica-vendas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-ink-600">Acompanhamento</div>
          <h1 className="m-0 mt-1 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Vendas registradas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
          <Download size={18} />
          Exportar CSV
        </Button>
      </div>

      {vendas.error ? (
        <ErroBox erro={vendas.error} onRetry={() => vendas.refetch()} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
          <div className="flex flex-col gap-2 rounded-[18px] bg-verde-600 p-5 text-white">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-verde-100">
              <CheckCircleFilled size={18} />
              Aprovadas (Verdinho)
            </span>
            <span className="text-[30px] font-extrabold tracking-[-0.03em]">{vendas.isLoading ? '…' : brl(aprovadas.reduce((a, v) => a + v.valor_adesao, 0))}</span>
            <span className="text-[12px] font-semibold text-verde-100">{aprovadas.length} vendas · indicadores {brl(aprovadas.reduce((a, v) => a + v.estimativa_indicador, 0))} · Geralindica {brl(aprovadas.reduce((a, v) => a + (v.estimativa_geralindica ?? 0), 0))}</span>
          </div>
          <Kpi tom="ambar" icon={<Clock size={17} strokeWidth={2.6} />} rotulo="Aguardando entrevista" valor={brl(aguardando.reduce((a, v) => a + v.valor_adesao, 0))} sub={`${aguardando.length} com o consultor até a entrevista`} />
          <Kpi tom="vermelho" icon={<Undo2 size={17} />} rotulo="Reprovadas" valor={String(reprovadas.length)} sub="valor devolvido ao cliente pelo consultor" />
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3.5">
          <span className="mr-2 text-[16px] font-extrabold">Vendas</span>
          {FILTROS.map((f) => (
            <Chip key={f.k} active={filtro === f.k} onClick={() => setFiltro(f.k)} className="inline-flex h-8 items-center rounded-full px-3 text-[13px]">
              {f.label}
            </Chip>
          ))}
        </div>
        {vendas.isLoading ? (
          <Carregando />
        ) : !linhas.length ? (
          <div className="p-4">
            <Vazio titulo="Nenhuma venda com esse status" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              <div className="grid grid-cols-[96px_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_104px_110px_110px_170px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
                <span>Data</span>
                <span>Cliente</span>
                <span>Consultor</span>
                <span>Indicador</span>
                <span className="text-right">Adesão</span>
                <span className="text-right">Indicador</span>
                <span className="text-right">Geralindica</span>
                <span>Status</span>
              </div>
              {linhas.slice(0, 300).map((r) => (
                <div key={r.id} className="grid grid-cols-[96px_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_104px_110px_110px_170px] items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
                  <span className="text-[13px] font-semibold">{dataBR(r.data_venda + 'T12:00')}</span>
                  <span className="truncate font-bold">{r.cliente}</span>
                  <span className="truncate">{r.consultor}</span>
                  <span className="truncate">{r.indicador}</span>
                  <span className="text-right font-semibold">{brl(r.valor_adesao)}</span>
                  <span className={cn('text-right font-extrabold', r.status === 'reprovado' && 'text-ink-400')}>{brl(r.estimativa_indicador)}</span>
                  <span
                    className={cn('text-right font-extrabold', r.status !== 'aprovado' && 'text-ink-400')}
                    title={r.status === 'aprovado' ? `Imposto ${dec(r.aliquota)}% · bonificação ${r.bonificacao_pct == null ? '—' : `${dec(r.bonificacao_pct)}%`}` : 'Só depois do Verdinho'}
                  >
                    {r.status === 'aprovado' ? (r.estimativa_geralindica == null ? 'a definir' : brl(r.estimativa_geralindica)) : '—'}
                  </span>
                  <StatusBadge status={r.status} size="md" />
                </div>
              ))}
            </div>
          </div>
        )}
        {linhas.length > 300 && <div className="border-t border-ink-100 px-5 py-3 text-[12px] text-ink-600">Mostrando 300 de {linhas.length}. Exporte o CSV para ver tudo.</div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3.5">
          <Thermometer size={18} className="text-laranja-fg" />
          <span className="text-[16px] font-extrabold">Temperatura dos consultores</span>
        </div>
        {consultores.isLoading ? (
          <Carregando />
        ) : consultores.error ? (
          <div className="p-4">
            <ErroBox erro={consultores.error} onRetry={() => consultores.refetch()} />
          </div>
        ) : (
          (consultores.data ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
              <span className="min-w-[160px] flex-1 truncate font-bold">
                {c.nome_exibicao}
                {!c.publicado && <span className="ml-2 text-[12px] font-semibold text-ink-400">(fora da vitrine)</span>}
              </span>
              <span className="text-[12px] text-ink-600">
                {c.vendas} aprovadas · {c.vendas_30d} em 30 dias · {c.ocupacao}/{c.max_indicadores} indicadores
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full" style={{ width: `${c.temperatura}%`, background: faixaTemperatura(c.temperatura).barra }} />
              </div>
              <TemperaturaBadge valor={c.temperatura} small />
            </div>
          ))
        )}
      </Card>

      <div className="flex items-start gap-1.5 text-[12px] font-semibold leading-[1.5] text-ink-400">
        <Info size={15} className="mt-px shrink-0" />
        A plataforma não recebe nem paga nada: o consultor registra a venda e faz os Pix por fora. A parte da Geralindica sai do bolo (parte do consultor na adesão + bonificação, sem o imposto dele), pela divisão de Admin → Split, e só vale depois do Verdinho. A fórmula da temperatura é provisória.
      </div>
    </>
  )
}

const dec = (n: number) => n.toFixed(2).replace('.', ',')

function Kpi({ tom, icon, rotulo, valor, sub }: { tom: 'ambar' | 'vermelho'; icon: ReactNode; rotulo: string; valor: string; sub: string }) {
  const cor = { ambar: 'text-ambar-fg', vermelho: 'text-vermelho-fg' }[tom]
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
