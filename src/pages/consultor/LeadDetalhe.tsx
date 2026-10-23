import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Hourglass,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Percent,
  Send,
  StickyNote,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl, cn } from '@/lib/utils'
import { ETAPAS, corEtapa, dataBR, dataHoraBR, iniciais, mascararCPFCompleto, mascararTelefoneCompleto, nomeEtapa, primeiroNome } from '@/lib/negocio'
import type { Etapa, LeadEvento } from '@/lib/types'
import { ALTERNATIVAS, estimarMensalidade, gerarNovaCotacao, linkWhatsApp, numeroInternacional, pedirDescontoAdministradora, reenviarCotacao, type Alternativa } from '@/integrations'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { useLead } from './dados'

const ICONE_EVENTO: Record<LeadEvento['tipo'], { icon: LucideIcon; bg: string; fg: string }> = {
  robo: { icon: Bot, bg: '#E7EFFC', fg: '#1F5BBF' },
  pdf: { icon: FileText, bg: '#FCEAE8', fg: '#B3372F' },
  consultor: { icon: User, bg: '#EAEFF5', fg: '#1F2E45' },
  cliente: { icon: MessageCircle, bg: '#FFF3D6', fg: '#9A5B00' },
  sistema: { icon: CheckCircle2, bg: '#ECF8F1', fg: '#0A7F47' },
  nota: { icon: StickyNote, bg: '#F4F7FA', fg: '#4A5B70' },
}

/** Ação do detalhe do lead: executa, recarrega o lead/CRM e avisa o resultado. */
function useAcao<T>(id: string | undefined, fn: (v: T) => Promise<unknown>, ok: (v: T) => string) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['con', 'lead', id] })
      qc.invalidateQueries({ queryKey: ['con', 'leads'] })
      toast(ok(v))
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
}

export function LeadDetalhe() {
  const { id } = useParams()
  const q = useLead(id)
  const toast = useToast()
  const [codigo, setCodigo] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [nota, setNota] = useState('')
  const [alts, setAlts] = useState<Alternativa[]>(['coparticipacao'])
  const [desconto, setDesconto] = useState(25)
  const [valor, setValor] = useState('')
  const lead = q.data?.lead

  useEffect(() => {
    if (lead) {
      setValor(lead.valor_adesao ? String(lead.valor_adesao).replace('.', ',') : '')
      if (lead.desconto_pct) setDesconto(lead.desconto_pct)
    }
  }, [lead?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const atribuir = useAcao(id, async (cod: string) => {
    const { error } = await supabase.rpc('confirmar_atribuicao', { p_lead: id!, p_codigo: cod })
    if (error) throw error
  }, () => 'Atribuição confirmada. A comissão vai para o indicador certo.')
  const mover = useAcao(id, async (etapa: Etapa) => {
    const { error } = await supabase.from('leads').update({ etapa }).eq('id', id!)
    if (error) throw error
  }, (e) => `Lead movido para ${nomeEtapa(e)}.`)
  const salvarValor = useAcao(id, async (v: number) => {
    const { error } = await supabase.from('leads').update({ valor_adesao: v }).eq('id', id!)
    if (error) throw error
  }, () => 'Valor da adesão atualizado.')
  const addNota = useAcao(id, async (texto: string) => {
    const { error } = await supabase.from('lead_eventos').insert({ lead_id: id!, tipo: 'nota', texto })
    if (error) throw error
  }, () => 'Anotação salva no histórico.')
  const reenviar = useAcao(id, async () => reenviarCotacao(id!), () => 'Cotação reenviada no WhatsApp.')
  const novaCot = useAcao(id, (txt: string) => gerarNovaCotacao(id!, alts, txt), () => 'Nova cotação enviada ao cliente.')
  const pedirDesc = useAcao(id, (pct: number) => pedirDescontoAdministradora(id!, pct), (p) => `Pedido de ${p}% enviado à Administradora.`)

  if (q.isLoading) return <Carregando />
  if (q.error) return <ErroBox erro={q.error} onRetry={() => q.refetch()} />
  if (!lead)
    return (
      <Vazio titulo="Lead não encontrado" texto="Ele pode ter sido transferido ou você não tem acesso.">
        <Link to="/consultor/leads" className="mt-2 font-bold text-verde-700">
          Voltar ao funil
        </Link>
      </Vazio>
    )

  const cor = corEtapa(lead.etapa)
  const mensal = Math.round((lead.valor_adesao ?? 0) * 0.92)
  const estimada = estimarMensalidade(mensal, alts)
  const semCanal = !lead.canal_id
  const zap = numeroInternacional(lead.telefone)
  const ordem = ['Tipo', 'Idade', 'Profissão', 'Abrangência', 'Acomodação', 'Obstetrícia', 'Dependentes']
  const pos = (k: string) => (ordem.includes(k) ? ordem.indexOf(k) : ordem.length)
  const triagem = Object.entries(lead.triagem ?? {}).sort(([a], [b]) => pos(a) - pos(b))

  return (
    <>
      <Link to="/consultor/leads" className="flex items-center gap-1.5 self-start text-[13px] font-bold text-ink-600 hover:text-ink-950">
        <ArrowLeft size={18} />
        Voltar ao funil
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-ink-950 text-[20px] font-extrabold text-white">{iniciais(lead.nome)}</span>
        <div className="min-w-[220px] flex-1">
          <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[28px]">{lead.nome}</h1>
          <div className="text-[14px] text-ink-600">
            {lead.plano ?? 'Plano a definir'} · entrou em {dataBR(lead.created_at)}
            {lead.indicador && ` · via ${lead.indicador.nome}`}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 text-[13px] font-bold" style={{ background: cor.bg, color: cor.fg }}>
          <span className="size-2 rounded-full" style={{ background: cor.dot }} />
          {nomeEtapa(lead.etapa)}
        </span>
        <span className="text-[26px] font-extrabold tracking-[-0.03em]">{lead.valor_adesao ? brl(lead.valor_adesao) : '—'}</span>
      </div>

      {semCanal && (
        <div className="flex flex-wrap items-start gap-3.5 rounded-2xl border border-[#F2C46A] bg-ambar-bg p-[18px]">
          <TriangleAlert size={26} className="text-ambar-fg" />
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-[15px] font-extrabold text-[#6B3F00]">Atribuição não confirmada</span>
            <span className="text-[13px] leading-[1.5] text-[#7A4A00]">
              O código do canal chegou vazio no WhatsApp. Peça ao cliente o código impresso no material (ex.: no encosto do banco) para creditar a comissão ao indicador certo.
            </span>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (codigo.trim()) atribuir.mutate(codigo.trim())
            }}
          >
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ex.: IDK7F3A2C"
              aria-label="Código do canal"
              className="h-[42px] w-[180px] rounded-[10px] border border-[#F2C46A] bg-white px-3 font-mono text-[13px] outline-none"
            />
            <Button type="submit" variant="dark" size="sm" className="h-[42px] text-[13px]" disabled={atribuir.isPending}>
              Confirmar
            </Button>
          </form>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-extrabold">Respostas da triagem</span>
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-azul-fg">
                <Bot size={16} />
                Robô · {lead.triagem_passo}/7 perguntas
              </span>
            </div>
            {triagem.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {triagem.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 rounded-[12px] bg-ink-50 px-3 py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[.04em] text-ink-600">{k}</span>
                    <span className="text-[15px] font-bold">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[14px] text-ink-600">O robô ainda está fazendo a triagem com o cliente.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-3.5 p-5">
            <span className="text-[16px] font-extrabold">Conversa resumida</span>
            <div className="flex flex-col">
              {q.data!.eventos.map((ev) => {
                const ic = ICONE_EVENTO[ev.tipo] ?? ICONE_EVENTO.nota
                return (
                  <div key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex size-7 items-center justify-center rounded-full" style={{ background: ic.bg, color: ic.fg }}>
                        <ic.icon size={15} />
                      </span>
                      <span className="min-h-3.5 w-0.5 flex-1 bg-ink-100" />
                    </div>
                    <div className="flex-1 pb-3.5">
                      <div className="text-[14px] font-semibold leading-[1.45]">{ev.texto}</div>
                      <div className="text-[12px] text-ink-400">{dataHoraBR(ev.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (nota.trim()) addNota.mutate(nota.trim(), { onSuccess: () => setNota('') })
              }}
            >
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Adicionar anotação ao histórico"
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-ink-200 px-3 text-[14px] outline-none focus:border-verde-500"
              />
              <Button type="submit" variant="outline" size="sm" className="h-10" disabled={!nota.trim() || addNota.isPending}>
                Salvar
              </Button>
            </form>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-[18px]">
            <span className="text-[15px] font-extrabold">Etapa do funil</span>
            <select
              value={lead.etapa}
              onChange={(e) => mover.mutate(e.target.value as Etapa)}
              disabled={mover.isPending}
              aria-label="Mover para a etapa"
              className="h-11 rounded-[10px] border border-ink-200 bg-white px-3 text-[14px] font-bold outline-none focus:border-verde-500"
            >
              {ETAPAS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const v = Number(valor.replace(/\./g, '').replace(',', '.'))
                if (!v || v <= 0) return toast('Informe o valor da adesão.', 'erro')
                salvarValor.mutate(v)
              }}
            >
              <label className="flex flex-1 flex-col gap-1 text-[12px] font-bold text-ink-600">
                Valor da adesão (R$)
                <input value={valor} inputMode="decimal" onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))} className="h-10 rounded-[10px] border border-ink-200 px-3 text-[14px] font-bold text-ink-950 outline-none focus:border-verde-500" />
              </label>
              <Button type="submit" variant="outline" size="sm" className="h-10" disabled={salvarValor.isPending}>
                Salvar
              </Button>
            </form>
            <p className="m-0 text-[12px] leading-[1.45] text-ink-400">Contrato emitido cria a transação; pagamento fica em custódia até a entrevista; Aprovado libera a comissão (Verdinho).</p>
          </Card>

          <Card className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center gap-3">
              <span className="flex h-[52px] w-11 items-center justify-center rounded-lg bg-vermelho-bg text-[11px] font-extrabold text-vermelho-fg">PDF</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">
                  Cotacao_{primeiroNome(lead.nome)}_{(lead.plano ?? 'plano').split(' ')[0]}.pdf
                </div>
                <div className="text-[12px] text-ink-600">3 opções · gerada pelo robô (Cotaí)</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-[42px]" disabled={reenviar.isPending} onClick={() => reenviar.mutate(undefined)}>
              {reenviar.isPending ? <Loader2 size={18} className="animate-spin" /> : reenviar.isSuccess ? <Check size={18} /> : <Send size={18} />}
              {reenviar.isSuccess ? 'Cotação reenviada no WhatsApp' : 'Reenviar cotação'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-[10px] bg-ink-50 px-2.5 py-2">
                <span className="text-[11px] text-ink-600">CPF</span>
                <span className="truncate font-mono text-[12px]">{mostrar ? lead.cpf ?? '—' : mascararCPFCompleto(lead.cpf)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-[10px] bg-ink-50 px-2.5 py-2">
                <span className="text-[11px] text-ink-600">Tel.</span>
                <span className="truncate font-mono text-[12px]">{mostrar ? lead.telefone ?? '—' : mascararTelefoneCompleto(lead.telefone)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMostrar(!mostrar)} className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-ink-600">
                {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
                {mostrar ? 'Ocultar dados' : 'Mostrar dados'}
              </button>
              {zap && (
                <a href={linkWhatsApp(zap, `Olá, ${primeiroNome(lead.nome)}! Aqui é da Geralindica.`)} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1.5 text-[12px] font-bold text-verde-700">
                  <MessagesSquare size={15} />
                  Abrir conversa
                </a>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-[18px]">
            <span className="text-[15px] font-extrabold">Oferecer alternativa mais barata</span>
            <div className="flex flex-wrap gap-1.5">
              {ALTERNATIVAS.map((a) => {
                const on = alts.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAlts(on ? alts.filter((x) => x !== a.id) : [...alts, a.id])}
                    className={cn('cursor-pointer rounded-full border px-3 py-[7px] text-[13px] font-bold', on ? 'border-verde-600 bg-verde-50 text-verde-900' : 'border-ink-200 bg-white text-ink-950')}
                  >
                    {a.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between rounded-[12px] bg-ink-50 px-3.5 py-3">
              <span className="text-[13px] font-semibold text-ink-600">Mensalidade estimada</span>
              <span className="text-[14px]">
                <s className="text-ink-400">{brl(mensal)}</s> <b className="text-[18px]">{brl(estimada)}</b>
              </span>
            </div>
            <Button variant="dark" size="sm" className="h-[42px]" disabled={!lead.valor_adesao || novaCot.isPending} onClick={() => novaCot.mutate(brl(estimada))}>
              {novaCot.isPending && <Loader2 size={18} className="animate-spin" />}
              Gerar nova cotação
            </Button>
          </Card>

          <Card className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                <Percent size={16} />
                Desconto na taxa de adesão
              </span>
              <span className="text-[24px] font-extrabold text-verde-700">{desconto}%</span>
            </div>
            <input type="range" min={15} max={50} step={5} value={desconto} onChange={(e) => setDesconto(+e.target.value)} aria-label="Desconto" className="w-full" />
            <div className="flex justify-between text-[11px] font-bold text-ink-400">
              <span>15%</span>
              <span>50%</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-600">Adesão com desconto</span>
              <span>
                <s className="text-ink-400">{brl(lead.valor_adesao ?? 0)}</s> <b>{brl((lead.valor_adesao ?? 0) * (1 - desconto / 100))}</b>
              </span>
            </div>
            {lead.desconto_status === 'solicitado' && lead.desconto_pct === desconto ? (
              <div className="flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-ambar-fg text-[14px] font-bold text-white">
                <Hourglass size={18} />
                Enviado à Administradora · aguardando
              </div>
            ) : (
              <Button variant="dark" size="sm" className="h-[42px]" disabled={!lead.valor_adesao || pedirDesc.isPending} onClick={() => pedirDesc.mutate(desconto)}>
                <Send size={18} />
                Pedir desconto à Administradora
              </Button>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
