import type { ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Download, Info, Loader2, Lock, LockOpen, Send, Undo2, X } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import type { StatusSaque, StatusTx } from '@/lib/types'
import { CheckCircleFilled } from '@/components/icons'
import { StatusBadge } from '@/components/ui/badges'
import { Chip, Field } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio, useToast } from '@/components/ui/feedback'

type Tx = { id: string; lead_id: string; created_at: string; cliente: string; consultor: string; indicador: string; bruto: number; comissao: number; status: StatusTx; etapa: string }
type SaqueAdm = { id: string; created_at: string; indicador: string; chave_pix: string | null; tipo_pessoa: string; valor: number; qtd: number; status: StatusSaque; decidido_em: string | null; motivo: string | null }
type Total = { status: StatusTx; qtd: number; bruto: number; comissao: number }

const FILTROS: { k: StatusTx | 'todos'; label: string }[] = [
  { k: 'todos', label: 'Todos' },
  { k: 'verdinho', label: 'Verdinho' },
  { k: 'custodia', label: 'Em custódia' },
  { k: 'pendente', label: 'Pendente' },
  { k: 'em_saque', label: 'Saque solicitado' },
  { k: 'repassado', label: 'Repassado' },
  { k: 'estornado', label: 'Estornado' },
]

export function Financeiro() {
  const qc = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<StatusTx | 'todos'>('todos')
  const [resultado, setResultado] = useState<{ tx: Tx; aprovado: boolean } | null>(null)

  const totais = useQuery({
    queryKey: ['adm', 'totais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_totais')
      if (error) throw error
      const m = new Map(((data ?? []) as Total[]).map((t) => [t.status, { ...t, bruto: Number(t.bruto), comissao: Number(t.comissao), qtd: Number(t.qtd) }]))
      const g = (s: StatusTx) => m.get(s) ?? { status: s, qtd: 0, bruto: 0, comissao: 0 }
      return { custodia: g('custodia'), verdinho: g('verdinho'), emSaque: g('em_saque'), estornado: g('estornado'), repassado: g('repassado') }
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

  const entrevista = useMutation({
    mutationFn: async ({ tx, aprovado }: { tx: Tx; aprovado: boolean }) => {
      const { error } = await supabase.rpc('admin_resultado_entrevista', { p_transacao: tx.id, p_aprovado: aprovado })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['adm'] })
      setResultado(null)
      toast(v.aprovado ? 'Verdinho ✓ marcado. A comissão ficou liberada para o indicador pedir o saque.' : 'Reprovação registrada. O valor é estornado ao cliente.')
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
    a.download = `geralindica-transacoes-${new Date().toISOString().slice(0, 10)}.csv`
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
          <Kpi tom="azul" icon={<Clock size={17} strokeWidth={2.6} />} rotulo="Saques a pagar" valor={t ? brl(t.emSaque.comissao) : '…'} sub={`${t?.emSaque.qtd ?? 0} comissões em pedidos de saque`} />
          <Kpi tom="vermelho" icon={<Undo2 size={17} />} rotulo="Estornados" valor={t ? brl(t.estornado.bruto) : '…'} sub="100% devolvido ao cliente" />
          <Kpi tom="ink" icon={<Send size={17} />} rotulo="Repassados" valor={t ? brl(t.repassado.comissao) : '…'} sub="comissões pagas via Pix" />
        </div>
      )}

      <FilaSaques />

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
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px_104px_132px_184px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
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
                  <div key={r.id} className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px_104px_132px_184px] items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
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
                    {r.status === 'pendente' || r.status === 'custodia' ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setResultado({ tx: r, aprovado: true })}
                          title="A Administradora aprovou a entrevista de saúde"
                          className="flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-1 rounded-[10px] bg-verde-600 text-[12px] font-extrabold text-white hover:bg-verde-700"
                        >
                          <Check size={15} />
                          Verdinho
                        </button>
                        <button
                          type="button"
                          onClick={() => setResultado({ tx: r, aprovado: false })}
                          title="A Administradora reprovou a entrevista de saúde"
                          className="flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-1 rounded-[10px] bg-ink-100 text-[12px] font-extrabold text-vermelho-fg hover:bg-vermelho-bg"
                        >
                          <X size={15} />
                          Reprovar
                        </button>
                      </div>
                    ) : (
                    <button
                      type="button"
                      disabled={!pode || liberar.isPending}
                      onClick={() => liberar.mutate(r.id)}
                      title={pode ? 'Pagar esta comissão agora via Pix (sem esperar o indicador pedir)' : 'Disponível só quando o status é Verdinho'}
                      className={cn(
                        'flex h-[34px] items-center justify-center gap-1 rounded-[10px] text-[12px] font-extrabold',
                        pode ? 'cursor-pointer bg-verde-600 text-white hover:bg-verde-700' : 'cursor-not-allowed bg-ink-100 text-ink-400',
                      )}
                    >
                      {liberar.isPending && liberar.variables === r.id ? <Loader2 size={15} className="animate-spin" /> : <LockOpen size={15} />}
                      {r.status === 'repassado' ? 'Paga' : r.status === 'em_saque' ? 'Na fila de saques' : 'Pagar agora'}
                    </button>
                    )}
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
        Só o admin marca Verdinho ou Reprovado, depois que a Administradora confirma a entrevista de saúde. Todo saque passa por aqui antes do Pix.
      </div>

      <Modal aberto={!!resultado} onFechar={() => setResultado(null)} titulo={resultado?.aprovado ? 'Confirmar Verdinho?' : 'Confirmar reprovação?'} sheetNoMobile={false}>
        {resultado && (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-[14px] leading-[1.55] text-ink-800">
              {resultado.aprovado
                ? `A Administradora aprovou a entrevista de saúde de ${resultado.tx.cliente}? A comissão de ${brl(resultado.tx.comissao)} fica liberada para ${resultado.tx.indicador} pedir o saque.`
                : `${resultado.tx.cliente} foi reprovado(a) na entrevista de saúde? O valor da adesão é estornado 100% ao cliente e não há comissão.`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="form" className="flex-1" onClick={() => setResultado(null)}>
                Cancelar
              </Button>
              <Button
                variant={resultado.aprovado ? 'primary' : 'dark'}
                size="form"
                className={cn('flex-1 font-extrabold', !resultado.aprovado && 'bg-vermelho-fg hover:bg-vermelho-fg/90')}
                disabled={entrevista.isPending}
                onClick={() => entrevista.mutate(resultado)}
              >
                {resultado.aprovado ? 'Marcar Verdinho' : 'Reprovar e estornar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/** Pedidos de saque dos indicadores: o admin confere, faz o Pix e marca como pago (ou recusa com motivo). */
function FilaSaques() {
  const qc = useQueryClient()
  const toast = useToast()
  const [recusar, setRecusar] = useState<SaqueAdm | null>(null)
  const [motivo, setMotivo] = useState('')
  const saques = useQuery({
    queryKey: ['adm', 'saques'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_saques')
      if (error) throw error
      return ((data ?? []) as SaqueAdm[]).map((s) => ({ ...s, valor: Number(s.valor) }))
    },
  })
  const decidir = useMutation({
    mutationFn: async ({ s, pagar, motivo }: { s: SaqueAdm; pagar: boolean; motivo?: string }) => {
      const { error } = pagar
        ? await supabase.rpc('admin_pagar_saque', { p_saque: s.id })
        : await supabase.rpc('admin_recusar_saque', { p_saque: s.id, p_motivo: motivo ?? '' })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['adm'] })
      setRecusar(null)
      setMotivo('')
      toast(v.pagar ? `Saque de ${brl(v.s.valor)} marcado como pago.` : 'Saque recusado. As comissões voltaram para o saldo do indicador.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const pendentes = (saques.data ?? []).filter((s) => s.status === 'solicitado')
  const recentes = (saques.data ?? []).filter((s) => s.status !== 'solicitado').slice(0, 5)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3.5">
        <span className="text-[16px] font-extrabold">Saques solicitados</span>
        {pendentes.length > 0 && <span className="rounded-full bg-azul-bg px-[9px] py-0.5 text-[12px] font-bold text-azul-fg">{pendentes.length} aguardando</span>}
      </div>
      {saques.isLoading ? (
        <Carregando />
      ) : saques.error ? (
        <div className="p-4">
          <ErroBox erro={saques.error} onRetry={() => saques.refetch()} />
        </div>
      ) : !pendentes.length && !recentes.length ? (
        <div className="p-4">
          <Vazio titulo="Nenhum pedido de saque" texto="Quando um indicador pedir saque das comissões em Verdinho, o pedido aparece aqui." />
        </div>
      ) : (
        <div className="flex flex-col">
          {[...pendentes, ...recentes].map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
              <div className="min-w-[180px] flex-1">
                <div className="font-bold">
                  {s.indicador} <span className="font-mono text-[12px] font-semibold text-ink-600">· {s.tipo_pessoa}</span>
                </div>
                <div className="text-[12px] text-ink-600">
                  {new Date(s.created_at).toLocaleDateString('pt-BR')} · {s.qtd} {s.qtd === 1 ? 'comissão' : 'comissões'} · Pix: <span className="font-mono">{s.chave_pix ?? 'sem chave'}</span>
                  {s.status === 'recusado' && s.motivo && ` · recusado: ${s.motivo}`}
                </div>
              </div>
              <span className="text-[16px] font-extrabold">{brl(s.valor)}</span>
              {s.status === 'solicitado' ? (
                <div className="flex gap-1.5">
                  <Button variant="primary" size="sm" className="h-[34px]" disabled={decidir.isPending} onClick={() => decidir.mutate({ s, pagar: true })}>
                    {decidir.isPending && decidir.variables?.s.id === s.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Pix feito · marcar pago
                  </Button>
                  <Button variant="outline" size="sm" className="h-[34px]" disabled={decidir.isPending} onClick={() => setRecusar(s)}>
                    Recusar
                  </Button>
                </div>
              ) : (
                <span className={cn('rounded-full px-[10px] py-[3px] text-[12px] font-bold', s.status === 'pago' ? 'bg-verde-50 text-verde-700' : 'bg-vermelho-bg text-vermelho-fg')}>
                  {s.status === 'pago' ? 'Pago' : 'Recusado'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal aberto={!!recusar} onFechar={() => setRecusar(null)} titulo="Recusar saque" sheetNoMobile={false}>
        {recusar && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!motivo.trim()) return toast('Informe o motivo da recusa.', 'erro')
              decidir.mutate({ s: recusar, pagar: false, motivo: motivo.trim() })
            }}
          >
            <p className="m-0 text-[14px] leading-[1.55] text-ink-800">
              O pedido de {brl(recusar.valor)} de {recusar.indicador} é cancelado e as comissões voltam para o saldo do indicador. O motivo aparece no histórico dele.
            </p>
            <Field label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ex.: chave Pix não confere com o CPF" />
            <Button type="submit" variant="dark" size="form" disabled={decidir.isPending}>
              Recusar saque
            </Button>
          </form>
        )}
      </Modal>
    </Card>
  )
}

function Kpi({ tom, icon, rotulo, valor, sub }: { tom: 'ambar' | 'azul' | 'vermelho' | 'ink'; icon: ReactNode; rotulo: string; valor: string; sub: string }) {
  const cor = { ambar: 'text-ambar-fg', azul: 'text-azul-fg', vermelho: 'text-vermelho-fg', ink: 'text-ink-800' }[tom]
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
