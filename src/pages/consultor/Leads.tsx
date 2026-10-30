import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Loader2, Search, User, UserPlus } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import { ETAPAS, nomeEtapa, tempoDesde, ETAPAS_FINAIS, formatarTelefone } from '@/lib/negocio'
import type { Etapa, LeadComOrigem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Carregando, ErroBox, Modal, useToast } from '@/components/ui/feedback'
import { useLeadsCRM } from './dados'

const DIA = 86400_000

export function Leads() {
  const leads = useLeadsCRM()
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)

  const funil = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const todos = (leads.data ?? []).filter((l) => l.etapa !== 'perdido')
    if (!q) return todos
    return todos.filter((l) => [l.nome, l.plano, l.canal?.codigo, l.indicador?.nome].some((x) => x?.toLowerCase().includes(q)))
  }, [leads.data, busca])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[28px]">Leads</h1>
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[12px] border border-ink-200 bg-white px-3 sm:flex-none">
            <Search size={19} className="text-ink-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead, plano ou canal" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" aria-label="Buscar leads" />
          </label>
          <Button variant="primary" size="sm" className="h-10" onClick={() => setNovo(true)}>
            <UserPlus size={18} />
            Novo lead
          </Button>
        </div>
      </div>

      {leads.isLoading ? <Carregando /> : leads.error ? <ErroBox erro={leads.error} onRetry={() => leads.refetch()} /> : <Kanban leads={funil} />}

      <NovoLead aberto={novo} onFechar={() => setNovo(false)} />
    </>
  )
}

// ---------------- Kanban ----------------
function Kanban({ leads }: { leads: LeadComOrigem[] }) {
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [arrastando, setArrastando] = useState<LeadComOrigem | null>(null)
  const [confirmar, setConfirmar] = useState<{ lead: LeadComOrigem; etapa: Etapa } | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const mover = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: Etapa }) => {
      const { error } = await supabase.from('leads').update({ etapa }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, etapa }) => {
      await qc.cancelQueries({ queryKey: ['con', 'leads'] })
      const antes = qc.getQueryData<LeadComOrigem[]>(['con', 'leads'])
      qc.setQueryData<LeadComOrigem[]>(['con', 'leads'], (old) => old?.map((l) => (l.id === id ? { ...l, etapa, updated_at: new Date().toISOString() } : l)))
      return { antes }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(['con', 'leads'], ctx.antes)
      toast(mensagemErro(e), 'erro')
    },
    onSuccess: (_d, v) => toast(`Lead movido para ${nomeEtapa(v.etapa)}.`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['con'] }),
  })

  const onDragEnd = (ev: DragEndEvent) => {
    setArrastando(null)
    const lead = ev.active.data.current?.lead as LeadComOrigem | undefined
    const etapa = ev.over?.id as Etapa | undefined
    if (!lead || !etapa || etapa === lead.etapa) return
    if (etapa === 'aprovado' || etapa === 'reprovado') setConfirmar({ lead, etapa })
    else mover.mutate({ id: lead.id, etapa })
  }

  const colunas = ETAPAS.filter((e) => e.kanban)
  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setArrastando((e.active.data.current?.lead as LeadComOrigem) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setArrastando(null)}>
        <div className="-mx-[18px] flex items-start gap-3 overflow-x-auto px-[18px] pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          {colunas.map((col) => (
            <Coluna key={col.id} col={col} leads={leads.filter((l) => l.etapa === col.id)} />
          ))}
        </div>
        <DragOverlay>{arrastando && <CartaoLead l={arrastando} sombra />}</DragOverlay>
      </DndContext>
      <p className="m-0 text-[12px] text-ink-400">Arraste os cards entre as colunas (no celular, segure o card antes de arrastar). Aprovados e reprovados aparecem por 30 dias. Registrar a venda no lead é o que conta na sua temperatura.</p>

      <Modal aberto={!!confirmar} onFechar={() => setConfirmar(null)} titulo={confirmar?.etapa === 'aprovado' ? 'Confirmar aprovação?' : 'Confirmar reprovação?'} sheetNoMobile={false}>
        {confirmar && (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-[14px] leading-[1.55] text-ink-800">
              {confirmar.etapa === 'aprovado'
                ? `A Administradora aprovou a entrevista de saúde de ${confirmar.lead.nome}? Registre a venda para ela contar na sua temperatura e aparecer para o indicador. Depois, faça o Pix do indicador e da Geralindica.`
                : `${confirmar.lead.nome} foi reprovado(a) na entrevista de saúde? Devolva o valor ao cliente e registre a venda como reprovada.`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="form" className="flex-1" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="form"
                className="flex-1"
                onClick={() => {
                  mover.mutate({ id: confirmar.lead.id, etapa: confirmar.etapa })
                  setConfirmar(null)
                }}
              >
                Só mover
              </Button>
              <Button
                variant={confirmar.etapa === 'aprovado' ? 'primary' : 'dark'}
                size="form"
                className={cn('flex-1 font-extrabold', confirmar.etapa === 'reprovado' && 'bg-vermelho-fg hover:bg-vermelho-fg/90')}
                onClick={() => {
                  nav(`/consultor/leads/${confirmar.lead.id}?venda=${confirmar.etapa}`)
                  setConfirmar(null)
                }}
              >
                Registrar venda
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function Coluna({ col, leads }: { col: (typeof ETAPAS)[number]; leads: LeadComOrigem[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const verde = col.id === 'aprovado'
  const total = leads.reduce((a, l) => a + (l.valor_adesao ?? 0), 0)
  return (
    <div
      ref={setNodeRef}
      className={cn('flex w-[272px] shrink-0 flex-col gap-2 rounded-2xl p-2.5 transition-shadow', isOver && 'ring-2 ring-verde-500 ring-offset-2')}
      style={{ background: col.bg }}
    >
      <div className="flex items-center gap-2 px-1.5 pb-1 pt-1.5">
        <span className="size-2 rounded-full" style={{ background: col.dot }} />
        <span className={cn('flex-1 text-[13px] font-extrabold', verde ? 'text-white' : 'text-ink-950')}>{col.nome}</span>
        <span className="rounded-full bg-white px-2 py-px text-[12px] font-extrabold text-ink-600">{leads.length}</span>
      </div>
      <div className={cn('px-1.5 pb-1 text-[11px] font-semibold', verde ? 'text-verde-100' : 'text-ink-600')}>{brl(total)} em adesões</div>
      <div className="flex min-h-[60px] flex-col gap-2">
        {leads.map((l) => (
          <Arrastavel key={l.id} l={l} />
        ))}
      </div>
    </div>
  )
}

function Arrastavel({ l }: { l: LeadComOrigem }) {
  const nav = useNavigate()
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: l.id, data: { lead: l } })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => nav(`/consultor/leads/${l.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') nav(`/consultor/leads/${l.id}`)
        else listeners?.onKeyDown?.(e)
      }}
      className={cn('touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-verde-500', isDragging && 'opacity-40')}
      aria-label={`${l.nome}, ${nomeEtapa(l.etapa)}. Enter abre; espaço para arrastar.`}
    >
      <CartaoLead l={l} />
    </div>
  )
}

function CartaoLead({ l, sombra }: { l: LeadComOrigem; sombra?: boolean }) {
  const final = ETAPAS_FINAIS.includes(l.etapa)
  const parado = Date.now() - new Date(l.updated_at).getTime()
  const stale = !final && parado >= 2 * DIA
  const semCanal = !l.canal_id
  return (
    <div
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-[12px] border bg-white p-3 shadow-[0_1px_2px_rgba(11,26,48,.05)] hover:shadow-md',
        semCanal ? 'border-[#F2C46A]' : 'border-ink-200',
        sombra && 'rotate-2 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-extrabold leading-[1.25]">{l.nome}</div>
        <span
          className={cn(
            'shrink-0 rounded-md px-[7px] py-0.5 text-[11px] font-bold',
            final ? 'bg-verde-50 text-verde-700' : stale ? 'bg-ambar-bg text-ambar-fg' : 'bg-ink-50 text-ink-600',
          )}
        >
          {final ? 'concluído' : `parado ${tempoDesde(l.updated_at)}`}
        </span>
      </div>
      <div className="text-[12px] text-ink-600">{l.plano ?? 'Plano a definir'}</div>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-extrabold">{l.valor_adesao ? brl(l.valor_adesao) : '—'}</span>
        <span
          className={cn(
            'rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold',
            semCanal ? 'border-[#F2C46A] bg-ambar-bg text-ambar-fg' : 'border-ink-200 bg-ink-50 text-ink-950',
          )}
        >
          {semCanal ? 'SEM CÓDIGO' : `CANAL ${String(l.canal?.numero ?? 1).padStart(2, '0')}`}
        </span>
      </div>
      <div className="flex items-center gap-1.5 border-t border-ink-100 pt-2 text-[12px] text-ink-600">
        <User size={14} />
        {semCanal ? 'Atribuição pendente' : l.indicador ? `via ${l.indicador.nome}` : 'indicador de outra carteira'}
      </div>
    </div>
  )
}

// ---------------- Novo lead (o consultor cadastra quem chamou no WhatsApp) ----------------
type CanalOpcao = { codigo: string; numero: number; nome: string; ind: { p: { nome: string } | null } | null }

function NovoLead({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const vazio = { codigo: '', nome: '', telefone: '', plano: '' }
  const [f, setF] = useState(vazio)
  const canais = useQuery({
    queryKey: ['con', 'canais'],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.from('canais').select('codigo, numero, nome, ind:indicadores(p:profiles(nome))').order('numero').limit(300)
      if (error) throw error
      return (data ?? []) as unknown as CanalOpcao[]
    },
  })
  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('criar_lead', {
        p_nome: f.nome.trim(),
        p_telefone: f.telefone || null,
        p_codigo: f.codigo || null,
        p_plano: f.plano.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['con'] })
      toast('Lead cadastrado.')
      setF(vazio)
      onFechar()
      nav(`/consultor/leads/${id}`)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Novo lead" largura={480}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (f.nome.trim().length < 2) return toast('Informe o nome do cliente.', 'erro')
          criar.mutate()
        }}
      >
        <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
          O cliente escaneou o QR Code e chamou você no WhatsApp com o código na mensagem? Cadastre aqui para acompanhar no funil.
        </p>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Código do indicador (está na mensagem do cliente)
          <select
            value={f.codigo}
            onChange={(e) => setF({ ...f, codigo: e.target.value })}
            className="h-12 rounded-[12px] border border-ink-200 bg-white px-3 text-[15px] font-medium outline-none focus:border-verde-500"
          >
            <option value="">Sem código (confirmar depois)</option>
            {canais.data?.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.ind?.p?.nome ?? 'Indicador'} · CANAL {String(c.numero).padStart(2, '0')} ({c.codigo})
              </option>
            ))}
          </select>
        </label>
        <Field label="Nome do cliente" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Marina Souza" />
        <Field label="WhatsApp do cliente" value={f.telefone} inputMode="tel" onChange={(e) => setF({ ...f, telefone: formatarTelefone(e.target.value) })} placeholder="(19) 99999-0000" />
        <Field label="Plano (opcional)" value={f.plano} onChange={(e) => setF({ ...f, plano: e.target.value })} placeholder="Amil S380 · PF" />
        <Button type="submit" variant="primary" size="form" disabled={criar.isPending}>
          {criar.isPending && <Loader2 size={18} className="animate-spin" />}
          Cadastrar lead
        </Button>
      </form>
    </Modal>
  )
}
