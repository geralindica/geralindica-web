import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Bot, Eye, Loader2, Send, ShieldAlert } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar, Card, TituloPagina } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { dataHoraBR, tempoDesde } from '@/lib/negocio'
import { cn } from '@/lib/utils'

export type Conversa = {
  consultor_id: string
  indicador_id: string | null
  titulo: string
  subtitulo: string
  ultima: string | null
  ultima_em: string | null
  nao_lidas: number
  monitorada: boolean
  pode_escrever: boolean
}
type Mensagem = { id: string; consultor_id: string; indicador_id: string | null; autor_id: string | null; texto: string; created_at: string; lida_em: string | null }

const chave = (c: Pick<Conversa, 'consultor_id' | 'indicador_id'>) => `${c.consultor_id}:${c.indicador_id ?? 'g'}`

export function useConversas() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['chat', 'conversas', profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_conversas')
      if (error) throw error
      return ((data ?? []) as Conversa[]).map((c) => ({ ...c, nao_lidas: Number(c.nao_lidas) }))
    },
    refetchInterval: 20_000,
  })
}

/** Contador do menu (mensagens não lidas em todas as conversas). */
export function useNaoLidas() {
  const q = useConversas()
  return (q.data ?? []).reduce((a, c) => a + c.nao_lidas, 0)
}

export const REGRAS_CHAT =
  'Chat monitorado por robô (cláusula 6.4 do contrato). Pode: ganhos, valores das vendas e dados de conta corrente. Não pode: telefone, e-mail, redes sociais, links, profissão ou como você faz as indicações. Quem desrespeitar tem o contrato cancelado e sai do site, junto com a outra parte.'

export function Mensagens() {
  const { profile } = useAuth()
  const conversas = useConversas()
  const [params, setParams] = useSearchParams()
  const admin = profile?.papel === 'admin'
  const sel = params.get('c')
  const lista = conversas.data ?? []
  const atual = lista.find((c) => chave(c) === sel) ?? null

  // No computador, abre a primeira conversa.
  useEffect(() => {
    if (!sel && lista.length && window.matchMedia('(min-width: 1024px)').matches) setParams({ c: chave(lista[0]) }, { replace: true })
  }, [sel, lista, setParams])

  return (
    <>
      <TituloPagina titulo="Mensagens" />
      {admin && <AlertasDoRobo />}
      {conversas.isLoading ? (
        <Carregando />
      ) : conversas.error ? (
        <ErroBox erro={conversas.error} onRetry={() => conversas.refetch()} />
      ) : !lista.length ? (
        <Vazio titulo="Nenhuma conversa ainda" texto={profile?.papel === 'indicador' ? 'Escolha um consultor para conversar com ele por aqui.' : 'As conversas aparecem aqui.'} />
      ) : (
        <Card className="grid min-h-[560px] overflow-hidden lg:grid-cols-[320px_1fr]">
          <div className={cn('flex flex-col border-ink-200 lg:border-r', atual && 'hidden lg:flex')}>
            {lista.map((c) => (
              <button
                key={chave(c)}
                type="button"
                onClick={() => setParams({ c: chave(c) })}
                className={cn('flex w-full cursor-pointer items-center gap-3 border-b border-ink-100 px-4 py-3 text-left hover:bg-ink-50', atual && chave(atual) === chave(c) && 'bg-verde-50')}
              >
                <Avatar nome={c.titulo} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold">{c.titulo}</span>
                    {c.ultima_em && <span className="ml-auto shrink-0 text-[11px] text-ink-400">{tempoDesde(c.ultima_em)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12px] text-ink-600">{c.ultima ?? c.subtitulo}</span>
                    {c.nao_lidas > 0 && <span className="ml-auto shrink-0 rounded-full bg-verde-600 px-[7px] py-px text-[11px] font-extrabold text-white">{c.nao_lidas}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {atual ? (
            <Conversa key={chave(atual)} c={atual} voltar={() => setParams({})} />
          ) : (
            <div className="hidden items-center justify-center p-8 text-[14px] text-ink-400 lg:flex">Escolha uma conversa</div>
          )}
        </Card>
      )}
    </>
  )
}

function Conversa({ c, voltar }: { c: Conversa; voltar: () => void }) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [barrada, setBarrada] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  const eu = profile!.id
  const admin = profile!.papel === 'admin'
  const comIndicador = c.indicador_id !== null
  const qk = useMemo(() => ['chat', 'msgs', c.consultor_id, c.indicador_id ?? 'g'], [c.consultor_id, c.indicador_id])

  const msgs = useQuery({
    queryKey: qk,
    queryFn: async () => {
      let q = supabase.from('mensagens').select('*').eq('consultor_id', c.consultor_id).order('created_at', { ascending: false }).limit(300)
      q = c.indicador_id ? q.eq('indicador_id', c.indicador_id) : q.is('indicador_id', null)
      const { data, error } = await q
      if (error) throw error
      return ((data ?? []) as Mensagem[]).reverse()
    },
    refetchInterval: 10_000,
  })

  // Mensagem nova chega na hora (Realtime) e marca como lida.
  useEffect(() => {
    const canal = supabase
      .channel(`chat-${c.consultor_id}-${c.indicador_id ?? 'g'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `consultor_id=eq.${c.consultor_id}` }, () => {
        qc.invalidateQueries({ queryKey: qk })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [c.consultor_id, c.indicador_id, qc, qk])

  const ultimaId = msgs.data?.at(-1)?.id
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
    if (!c.monitorada && msgs.data?.some((m) => !m.lida_em && m.autor_id !== eu)) {
      supabase.rpc('marcar_lidas', { p_consultor: c.consultor_id, p_indicador: c.indicador_id }).then(() => qc.invalidateQueries({ queryKey: ['chat', 'conversas'] }))
    }
  }, [ultimaId, c, eu, msgs.data, qc])

  const enviar = useMutation({
    mutationFn: async (t: string) => {
      const { data, error } = await supabase.rpc('enviar_mensagem', { p_consultor: c.consultor_id, p_indicador: c.indicador_id, p_texto: t })
      if (error) throw error
      return data as { ok: boolean; motivo?: string }
    },
    onSuccess: (r) => {
      if (!r.ok) {
        setBarrada(r.motivo ?? 'conteúdo proibido')
        return
      }
      setTexto('')
      setBarrada(null)
      qc.invalidateQueries({ queryKey: qk })
      qc.invalidateQueries({ queryKey: ['chat', 'conversas'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const minha = (m: Mensagem) => {
    if (c.monitorada) return m.autor_id === c.consultor_id
    if (!comIndicador && admin) return m.autor_id !== c.consultor_id
    return m.autor_id === eu
  }
  const rotuloAutor = (m: Mensagem) => {
    if (c.monitorada) return m.autor_id === c.consultor_id ? 'Consultor' : 'Indicador'
    if (!comIndicador && m.autor_id !== c.consultor_id) return 'Geralindica'
    return null
  }

  return (
    <div className={cn('flex min-h-[560px] flex-col', 'lg:flex')}>
      <div className="flex items-center gap-3 border-b border-ink-200 px-4 py-3">
        <button type="button" onClick={voltar} aria-label="Voltar para as conversas" className="cursor-pointer rounded-lg p-1 text-ink-600 lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <Avatar nome={c.titulo} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold">{c.titulo}</div>
          <div className="truncate text-[12px] text-ink-600">{c.subtitulo}</div>
        </div>
        {c.monitorada && <Eye size={18} className="text-ink-400" aria-label="Só leitura" />}
      </div>
      {comIndicador && (
        <div className="flex items-start gap-2 border-b border-ink-100 bg-azul-bg px-4 py-2.5 text-[12px] leading-[1.45] text-azul-fg">
          <Bot size={16} className="mt-px shrink-0" />
          <span>{REGRAS_CHAT}</span>
        </div>
      )}
      <div className="flex max-h-[60vh] min-h-[300px] flex-1 flex-col gap-2 overflow-y-auto bg-ink-50 px-4 py-4">
        {msgs.isLoading ? (
          <Carregando />
        ) : !msgs.data?.length ? (
          <div className="m-auto text-center text-[13px] text-ink-400">{comIndicador ? 'Comece a conversa: combine aqui os valores e os dados de conta para o Pix.' : 'Fale com a Geralindica sobre acertos de pagamento e dúvidas.'}</div>
        ) : (
          msgs.data.map((m) => {
            const mine = minha(m)
            const rot = rotuloAutor(m)
            return (
              <div key={m.id} className={cn('flex max-w-[82%] flex-col gap-0.5', mine ? 'self-end items-end' : 'self-start items-start')}>
                {rot && <span className="px-1 text-[11px] font-bold text-ink-400">{rot}</span>}
                <div className={cn('whitespace-pre-wrap break-words rounded-[14px] px-3 py-2 text-[14px] leading-[1.45]', mine ? 'rounded-br-[4px] bg-verde-600 text-white' : 'rounded-bl-[4px] border border-ink-200 bg-white')}>
                  {m.texto}
                </div>
                <span className="px-1 text-[10px] text-ink-400">{dataHoraBR(m.created_at)}</span>
              </div>
            )
          })
        )}
        <div ref={fim} />
      </div>
      {c.pode_escrever ? (
        <form
          className="flex flex-col gap-2 border-t border-ink-200 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (texto.trim()) enviar.mutate(texto)
          }}
        >
          {barrada && (
            <div role="alert" className="flex items-start gap-2 rounded-[12px] bg-vermelho-bg px-3 py-2.5 text-[13px] font-semibold leading-[1.45] text-vermelho-fg">
              <ShieldAlert size={17} className="mt-px shrink-0" />
              <span>
                Mensagem não enviada: o robô encontrou {barrada}. Neste chat só vale falar de ganhos e dados de conta. A Geralindica foi avisada; insistir pode cancelar o contrato de vocês dois.
              </span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (texto.trim()) enviar.mutate(texto)
                }
              }}
              rows={2}
              placeholder="Escreva sua mensagem"
              aria-label="Mensagem"
              className="min-h-[46px] flex-1 resize-none rounded-[12px] border border-ink-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-ink-950"
            />
            <Button type="submit" variant="primary" disabled={!texto.trim() || enviar.isPending} aria-label="Enviar" className="h-[46px] px-4">
              {enviar.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t border-ink-200 px-4 py-3 text-center text-[13px] text-ink-400">
          {c.monitorada ? 'Você está vendo esta conversa como monitoramento. Só as partes escrevem aqui.' : 'Vocês não estão mais na mesma carteira. A conversa fica só para consulta.'}
        </div>
      )}
    </div>
  )
}

type Alerta = { id: string; created_at: string; motivo: string; texto: string; autor: string | null; autor_id: string; consultor_id: string; consultor: string | null; indicador_id: string | null; indicador: string | null }

/** Admin: mensagens que o robô barrou. Dá para ignorar ou cancelar os dois contratos e tirar os dois do site. */
function AlertasDoRobo() {
  const qc = useQueryClient()
  const toast = useToast()
  const q = useQuery({
    queryKey: ['adm', 'alertas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_chat_alertas')
      if (error) throw error
      return (data ?? []) as Alerta[]
    },
    refetchInterval: 30_000,
  })
  const ignorar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_resolver_alerta', { p_alerta: id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adm', 'alertas'] }),
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const remover = useMutation({
    mutationFn: async (a: Alerta) => {
      if (!window.confirm(`Cancelar os contratos e tirar do site ${a.consultor ?? 'o consultor'} e ${a.indicador ?? 'o indicador'}? (cláusula 6.4)`)) return false
      const motivo = `Regra do chat (cláusula 6.4): ${a.motivo}`
      for (const id of [a.indicador_id, a.consultor_id].filter(Boolean) as string[]) {
        const { error } = await supabase.rpc('admin_remover_usuario', { p_usuario: id, p_motivo: motivo })
        if (error) throw error
      }
      const { error } = await supabase.rpc('admin_resolver_alerta', { p_alerta: a.id })
      if (error) throw error
      return true
    },
    onSuccess: (ok) => {
      if (!ok) return
      toast('Os dois foram removidos do site e os contratos cancelados.')
      qc.invalidateQueries({ queryKey: ['adm'] })
      qc.invalidateQueries({ queryKey: ['chat'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const itens = q.data ?? []
  if (!itens.length) return null
  return (
    <Card className="flex flex-col gap-2 border-vermelho-fg/30 p-4">
      <div className="flex items-center gap-2 text-[15px] font-extrabold text-vermelho-fg">
        <ShieldAlert size={18} />
        Robô barrou {itens.length} {itens.length === 1 ? 'mensagem' : 'mensagens'}
      </div>
      {itens.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-2 text-[13px]">
          <div className="min-w-0 flex-1">
            <div className="font-bold">
              {a.autor} · <span className="text-vermelho-fg">{a.motivo}</span> <span className="font-normal text-ink-400">· {dataHoraBR(a.created_at)}</span>
            </div>
            <div className="truncate text-ink-600">
              “{a.texto}” — {a.indicador} × {a.consultor}
            </div>
          </div>
          <button type="button" onClick={() => ignorar.mutate(a.id)} className="cursor-pointer font-bold text-ink-400 hover:text-ink-950">
            Ignorar
          </button>
          <button type="button" disabled={remover.isPending} onClick={() => remover.mutate(a)} className="cursor-pointer rounded-full bg-vermelho-bg px-3 py-1 font-bold text-vermelho-fg">
            Cancelar e remover os dois
          </button>
        </div>
      ))}
    </Card>
  )
}
