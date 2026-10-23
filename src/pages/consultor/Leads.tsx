import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, MessageCirclePlus, RefreshCw, Search, Send, User } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import { ETAPAS, nomeEtapa, tempoDesde, ETAPAS_FINAIS, formatarTelefone } from '@/lib/negocio'
import type { Etapa, LeadComOrigem } from '@/lib/types'
import { linkWhatsApp, numeroInternacional, reengajarLead } from '@/integrations'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Card, Segmentado } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio, useToast } from '@/components/ui/feedback'
import { emRecuperacao, useLeadsCRM } from './dados'

const DIA = 86400_000

export function Leads() {
  const leads = useLeadsCRM()
  const [aba, setAba] = useState<'funil' | 'rec'>('funil')
  const [busca, setBusca] = useState('')
  const [simular, setSimular] = useState(false)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const todos = leads.data ?? []
    if (!q) return todos
    return todos.filter((l) => [l.nome, l.plano, l.canal?.codigo, l.indicador?.nome].some((x) => x?.toLowerCase().includes(q)))
  }, [leads.data, busca])

  const rec = filtrados.filter(emRecuperacao)
  const funil = filtrados.filter((l) => !emRecuperacao(l) && l.etapa !== 'perdido')

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[28px]">Leads</h1>
        <Segmentado
          valor={aba}
          onChange={setAba}
          className="w-auto"
          opcoes={[
            { v: 'funil', label: 'Funil' },
            {
              v: 'rec',
              label: (
                <>
                  Recuperação
                  {(leads.data ?? []).filter(emRecuperacao).length > 0 && (
                    <span className="rounded-full bg-ambar-solid px-[7px] py-px text-[11px] text-white">{(leads.data ?? []).filter(emRecuperacao).length}</span>
                  )}
                </>
              ),
            },
          ]}
        />
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[12px] border border-ink-200 bg-white px-3 sm:flex-none">
            <Search size={19} className="text-ink-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lead, plano ou canal" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" aria-label="Buscar leads" />
          </label>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setSimular(true)} title="Ponto de encaixe do robô do WhatsApp">
            <MessageCirclePlus size={18} />
            Simular lead do WhatsApp
          </Button>
        </div>
      </div>

      {leads.isLoading ? (
        <Carregando />
      ) : leads.error ? (
        <ErroBox erro={leads.error} onRetry={() => leads.refetch()} />
      ) : aba === 'funil' ? (
        <Kanban leads={funil} />
      ) : (
        <Recuperacao leads={rec} />
      )}

      <SimularLead aberto={simular} onFechar={() => setSimular(false)} />
    </>
  )
}

// ---------------- Kanban ----------------
function Kanban({ leads }: { leads: LeadComOrigem[] }) {
  const qc = useQueryClient()
  const toast = useToast()
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
      <p className="m-0 text-[12px] text-ink-400">Arraste os cards entre as colunas (no celular, segure o card antes de arrastar). Aprovados e reprovados aparecem por 30 dias.</p>

      <Modal aberto={!!confirmar} onFechar={() => setConfirmar(null)} titulo={confirmar?.etapa === 'aprovado' ? 'Confirmar aprovação?' : 'Confirmar reprovação?'} sheetNoMobile={false}>
        {confirmar && (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-[14px] leading-[1.55] text-ink-800">
              {confirmar.etapa === 'aprovado'
                ? `A Administradora aprovou a entrevista de saúde de ${confirmar.lead.nome}? O status vira Verdinho ✓ e a comissão do indicador fica liberada para saque.`
                : `${confirmar.lead.nome} foi reprovado(a) na entrevista de saúde? O valor da adesão é estornado 100% ao cliente e não há comissão.`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="form" className="flex-1" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button
                variant={confirmar.etapa === 'aprovado' ? 'primary' : 'dark'}
                size="form"
                className={cn('flex-1 font-extrabold', confirmar.etapa === 'reprovado' && 'bg-vermelho-fg hover:bg-vermelho-fg/90')}
                onClick={() => {
                  mover.mutate({ id: confirmar.lead.id, etapa: confirmar.etapa })
                  setConfirmar(null)
                }}
              >
                {confirmar.etapa === 'aprovado' ? 'Aprovar (Verdinho)' : 'Reprovar e estornar'}
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

// ---------------- Recuperação ----------------
function Recuperacao({ leads }: { leads: LeadComOrigem[] }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const chamar = useMutation({
    mutationFn: async (l: LeadComOrigem) => {
      await reengajarLead(l.id)
      return l
    },
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['con'] })
      toast(`Reengajamento enviado para ${l.nome}. O lead voltou para o funil.`)
      const n = numeroInternacional(l.telefone)
      if (n) window.open(linkWhatsApp(n, `Olá, ${l.nome.split(' ')[0]}! Vi que você começou uma simulação de plano de saúde com a gente. Posso te ajudar a terminar?`), '_blank', 'noopener')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const cd = (iso: string) => {
    const r = Math.max(0, Math.floor((new Date(iso).getTime() + 2 * DIA - agora) / 1000))
    return { txt: [Math.floor(r / 3600), Math.floor((r % 3600) / 60), r % 60].map((n) => String(n).padStart(2, '0')).join(':'), urgente: r < 4 * 3600 }
  }

  return (
    <div className="flex max-w-[1100px] flex-col gap-3.5">
      <div className="flex items-start gap-2.5 rounded-[14px] bg-ambar-bg px-4 py-3.5 text-[13px] font-semibold leading-[1.5] text-ambar-fg">
        <RefreshCw size={20} className="shrink-0" />
        Quem abandona a triagem recebe uma mensagem automática do robô 48h depois. Você pode antecipar o contato manualmente.
      </div>
      {leads.length ? (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_120px_170px_150px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-3 text-[12px] font-bold text-ink-600 md:grid">
            <span>Lead</span>
            <span>Onde parou</span>
            <span>Origem</span>
            <span>Reengajamento em</span>
            <span />
          </div>
          {leads.map((l) => {
            const c = cd(l.abandonou_em!)
            return (
              <div key={l.id} className="grid grid-cols-2 items-center gap-3 border-b border-ink-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_120px_170px_150px]">
                <div>
                  <div className="text-[14px] font-bold">{l.nome}</div>
                  <div className="text-[12px] text-ink-600">abandonou há {tempoDesde(l.abandonou_em!, agora)}</div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px]">Pergunta {l.triagem_passo}/7</span>
                  <div className="h-[5px] overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full bg-azul-solid" style={{ width: `${(l.triagem_passo / 7) * 100}%` }} />
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold">{l.canal ? `CANAL ${String(l.canal.numero).padStart(2, '0')}` : 'SEM CÓDIGO'}</span>
                <span className={cn('font-mono text-[18px] font-semibold', c.urgente ? 'text-vermelho-fg' : 'text-ink-950')}>{c.txt}</span>
                <Button variant="outline" size="sm" className="col-span-2 h-9 text-[13px] md:col-span-1" disabled={chamar.isPending} onClick={() => chamar.mutate(l)}>
                  {chamar.isPending && chamar.variables?.id === l.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Chamar agora
                </Button>
              </div>
            )
          })}
        </Card>
      ) : (
        <Vazio titulo="Ninguém na fila de recuperação" texto="Quem abandonar a triagem do robô aparece aqui com a contagem para o reengajamento." />
      )}
    </div>
  )
}

// ---------------- Simular lead (ponto de encaixe do robô) ----------------
type CanalOpcao = { codigo: string; numero: number; nome: string; ind: { p: { nome: string } | null } | null }

function SimularLead({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const nav = useNavigate()
  const [f, setF] = useState({ codigo: '', nome: '', telefone: '', plano: '', valor: '' })
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
      const { data, error } = await supabase.rpc('registrar_lead_whatsapp', {
        p_codigo: f.codigo,
        p_nome: f.nome.trim(),
        p_telefone: f.telefone,
        p_plano: f.plano.trim() || null,
        p_valor: f.valor ? Number(f.valor.replace(/\./g, '').replace(',', '.')) : null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['con'] })
      toast('Lead criado como se tivesse chegado pelo WhatsApp.')
      setF({ codigo: '', nome: '', telefone: '', plano: '', valor: '' })
      onFechar()
      nav(`/consultor/leads/${id}`)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Simular lead do WhatsApp" largura={480}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (f.nome.trim().length < 3) return toast('Informe o nome do cliente.', 'erro')
          criar.mutate()
        }}
      >
        <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
          Em produção, o robô do WhatsApp cria o lead sozinho quando o cliente escaneia o QR Code. Aqui você testa esse fluxo.
        </p>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Código do canal (QR Code escaneado)
          <select
            value={f.codigo}
            onChange={(e) => setF({ ...f, codigo: e.target.value })}
            className="h-12 rounded-[12px] border border-ink-200 bg-white px-3 text-[15px] font-medium outline-none focus:border-verde-500"
          >
            <option value="">Sem código (atribuição pendente)</option>
            {canais.data?.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.ind?.p?.nome ?? 'Indicador'} · CANAL {String(c.numero).padStart(2, '0')} ({c.codigo})
              </option>
            ))}
          </select>
        </label>
        <Field label="Nome do cliente" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Marina Souza" />
        <Field label="WhatsApp do cliente" value={f.telefone} inputMode="tel" onChange={(e) => setF({ ...f, telefone: formatarTelefone(e.target.value) })} placeholder="(19) 99999-0000" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plano (opcional)" value={f.plano} onChange={(e) => setF({ ...f, plano: e.target.value })} placeholder="Amil S380 · PF" />
          <Field label="Adesão R$ (opcional)" value={f.valor} inputMode="decimal" onChange={(e) => setF({ ...f, valor: e.target.value.replace(/[^\d,.]/g, '') })} placeholder="1.000,00" />
        </div>
        <Button type="submit" variant="primary" size="form" disabled={criar.isPending}>
          {criar.isPending && <Loader2 size={18} className="animate-spin" />}
          Criar lead
        </Button>
      </form>
    </Modal>
  )
}
