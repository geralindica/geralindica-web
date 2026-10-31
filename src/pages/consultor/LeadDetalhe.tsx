import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Handshake, Loader2, MessageCircle, MessagesSquare, StickyNote, TriangleAlert, User, type LucideIcon } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { ETAPAS, STATUS_VENDA_OPCOES, aliquotaDoConsultor, calcularSplit, corEtapa, dataBR, dataHoraBR, iniciais, mascararCPFCompleto, mascararTelefoneCompleto, nomeEtapa, primeiroNome } from '@/lib/negocio'
import type { Etapa, LeadComOrigem, LeadEvento, StatusVenda, Venda } from '@/lib/types'
import { linkWhatsApp, numeroInternacional } from '@/integrations'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badges'
import { Card } from '@/components/painel/comum'
import { Field } from '@/components/ui/form'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { usePerfil } from '@/auth/AuthProvider'
import { useConfig } from '@/data/queries'
import { useLead, useMeuConsultor } from './dados'

const ICONE_EVENTO: Record<LeadEvento['tipo'], { icon: LucideIcon; bg: string; fg: string }> = {
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
  const [valor, setValor] = useState('')
  const lead = q.data?.lead

  useEffect(() => {
    if (lead) {
      setValor(lead.valor_adesao ? String(lead.valor_adesao).replace('.', ',') : '')
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
  const semCanal = !lead.canal_id
  const zap = numeroInternacional(lead.telefone)

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
              Este lead está sem código de indicador. Peça ao cliente o código que veio na mensagem ou está impresso no material (ex.: no encosto do banco) para o indicador certo receber a parte dele.
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
            <span className="text-[16px] font-extrabold">Histórico do atendimento</span>
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
            <p className="m-0 text-[12px] leading-[1.45] text-ink-400">A etapa é só do seu CRM. O que conta para o indicador e para a sua temperatura é a venda registrada abaixo.</p>
          </Card>

          <RegistrarVenda lead={lead} venda={q.data!.venda} />

          <Card className="flex flex-col gap-3 p-[18px]">
            <span className="text-[15px] font-extrabold">Contato do cliente</span>
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

        </div>
      </div>
    </>
  )
}

// ---------------- Registrar venda ----------------
/** O consultor registra a venda que fechou. Uma por lead: dá para atualizar o status depois da entrevista. */
function RegistrarVenda({ lead, venda }: { lead: LeadComOrigem; venda: Venda | null }) {
  const [params, setParams] = useSearchParams()
  const pedido = params.get('venda')
  const statusInicial: StatusVenda = pedido === 'aprovado' ? 'aprovado' : pedido === 'reprovado' ? 'reprovado' : venda?.status ?? 'aguardando_entrevista'
  const hoje = new Date()
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  const [aberto, setAberto] = useState(!!pedido)
  const [f, setF] = useState({
    cliente: venda?.cliente ?? primeiroNome(lead.nome),
    codigo: lead.canal?.codigo ?? '',
    valor: venda ? String(venda.valor_adesao).replace('.', ',') : lead.valor_adesao ? String(lead.valor_adesao).replace('.', ',') : '',
    data: venda?.data_venda ?? hojeISO,
    status: statusInicial,
    bonif: venda?.bonificacao_pct != null ? String(Number(venda.bonificacao_pct)).replace('.', ',') : '',
  })
  const toast = useToast()
  const perfil = usePerfil()
  const me = useMeuConsultor()
  const config = useConfig()
  const cfg = config.data
  // Bonificação vazia numa venda aprovada: o banco usa a sugerida em Admin → Split.
  const bonifTexto = f.bonif.trim() === '' && f.status === 'aprovado' && cfg?.bonificacao_padrao != null ? String(cfg.bonificacao_padrao) : f.bonif
  const valorNum = Number(f.valor.replace(/\./g, '').replace(',', '.')) || 0
  const aliq = cfg ? aliquotaDoConsultor(cfg, perfil.tipo_pessoa, me.data?.faixa_pj ?? 1) : null
  const previa = cfg ? calcularSplit(valorNum, aliq, cfg.pct_indicador, cfg.pct_consultor_restante, Number(bonifTexto.replace(',', '.')) || 0) : null
  const salvar = useAcao(lead.id, async () => {
    const v = Number(f.valor.replace(/\./g, '').replace(',', '.'))
    const { error } = await supabase.rpc('registrar_venda', {
      p_lead: lead.id,
      p_cliente: f.cliente.trim(),
      p_codigo: f.codigo.trim() || null,
      p_valor: v,
      p_data: f.data,
      p_status: f.status,
      p_bonificacao: f.bonif.trim() === '' ? null : Number(f.bonif.replace(',', '.')),
    })
    if (error) throw error
  }, () => (f.status === 'aprovado' ? 'Venda registrada. Agora faça o Pix do indicador e da Geralindica.' : 'Venda registrada.'))

  return (
    <Card className="flex flex-col gap-3 p-[18px]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
          <Handshake size={17} />
          Venda
        </span>
        {venda && <StatusBadge status={venda.status} size="md" />}
      </div>
      {venda && !aberto ? (
        <>
          <div className="text-[13px] leading-[1.5] text-ink-600">
            {venda.cliente} · {brl(venda.valor_adesao)} · {dataBR(venda.data_venda + 'T12:00')}
          </div>
          <Button variant="outline" size="sm" className="h-[42px]" onClick={() => setAberto(true)}>
            Atualizar venda
          </Button>
        </>
      ) : !aberto ? (
        <Button variant="primary" size="sm" className="h-[42px] font-extrabold" onClick={() => setAberto(true)}>
          <Handshake size={18} />
          Registrar venda
        </Button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const v = Number(f.valor.replace(/\./g, '').replace(',', '.'))
            if (!f.cliente.trim()) return toast('Informe o primeiro nome do cliente.', 'erro')
            if (!v || v <= 0) return toast('Informe o valor da adesão.', 'erro')
            salvar.mutate(undefined, {
              onSuccess: () => {
                setAberto(false)
                if (pedido) setParams({}, { replace: true })
              },
            })
          }}
        >
          <Field label="Cliente (primeiro nome)" value={f.cliente} maxLength={60} onChange={(e) => setF({ ...f, cliente: e.target.value })} />
          <Field label="Código do indicador" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })} placeholder="Vazio se o cliente veio sem indicador" className="font-mono" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor da adesão (R$)" value={f.valor} inputMode="decimal" onChange={(e) => setF({ ...f, valor: e.target.value.replace(/[^\d,.]/g, '') })} />
            <Field label="Data da venda" type="date" value={f.data} max={hojeISO} onChange={(e) => setF({ ...f, data: e.target.value })} />
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            Status
            <select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as StatusVenda })}
              className="h-12 rounded-[12px] border border-ink-200 bg-white px-3 text-[15px] font-medium outline-none focus:border-verde-500"
            >
              {STATUS_VENDA_OPCOES.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {f.status === 'aprovado' && (
            <Field
              label="Bonificação da operadora (% da adesão)"
              value={f.bonif}
              inputMode="decimal"
              placeholder={cfg?.bonificacao_padrao != null ? `${String(cfg.bonificacao_padrao).replace('.', ',')} (sugerida)` : ''}
              onChange={(e) => setF({ ...f, bonif: e.target.value.replace(/[^\d,.]/g, '') })}
            />
          )}
          {previa && valorNum > 0 && f.status !== 'reprovado' && (
            <div className="flex flex-col gap-1 rounded-[12px] bg-ink-50 px-3 py-2.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-600">Seu imposto ({aliq == null ? 'a definir' : `${String(aliq).replace('.', ',')}%`})</span>
                <span className="font-bold">− {brl(previa.imposto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Pix ao indicador</span>
                <span className="font-extrabold text-verde-700">{brl(previa.indicador)}</span>
              </div>
              {f.status === 'aprovado' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Pix à Geralindica</span>
                    <span className="font-extrabold">{previa.geralindica == null ? 'a definir' : brl(previa.geralindica)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Fica com você (com a bonificação)</span>
                    <span className="font-bold">{previa.consultor == null ? 'a definir' : brl(previa.consultor)}</span>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="m-0 text-[12px] leading-[1.45] text-ink-600">
            O dinheiro fica com você até a entrevista de saúde. Reprovado: devolva ao cliente. Aprovado: faça o Pix do indicador e, quando a bonificação cair, o da Geralindica.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-[42px] flex-1" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" className="h-[42px] flex-1 font-extrabold" disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 size={18} className="animate-spin" />}
              Salvar venda
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
