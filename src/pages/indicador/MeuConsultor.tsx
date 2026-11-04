import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Info, Loader2, MessageCircle, Star, ArrowLeftRight } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { usePerfil } from '@/auth/AuthProvider'
import { useAvaliacoes, useConsultores } from '@/data/queries'
import { linkWhatsApp } from '@/integrations'
import { dataBR } from '@/lib/negocio'
import type { Consultor } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { HotBadge, Pill, TemperaturaBadge } from '@/components/ui/badges'
import { Avatar, Card } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'
import { useFunil, useMeuVinculo } from './dados'

type Fase = 'idle' | 'lista' | 'confirma' | 'ok'

export function MeuConsultor() {
  const p = usePerfil()
  const qc = useQueryClient()
  const toast = useToast()
  const vinculo = useMeuVinculo()
  const cons = useConsultores()
  const funil = useFunil()
  // WhatsApp do consultor atual (sem telefone cadastrado, o banco devolve o número geral da Geralindica).
  const zapConsultor = useQuery({
    queryKey: ['ind', 'zap-consultor', vinculo.data?.consultor_id ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('whatsapp_meu_consultor')
      if (error) throw error
      return data as string | null
    },
  })
  const [fase, setFase] = useState<Fase>('idle')
  const [novo, setNovo] = useState<Consultor | null>(null)

  const trocar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('indicadores').update({ consultor_id: id }).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ind'] })
      qc.invalidateQueries({ queryKey: ['consultores'] })
      setFase('ok')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (vinculo.isLoading || cons.isLoading) return <Carregando />
  if (vinculo.error || cons.error) return <ErroBox erro={vinculo.error || cons.error} onRetry={() => (vinculo.refetch(), cons.refetch())} />

  const atual = cons.data!.find((c) => c.id === vinculo.data!.consultor_id) ?? null
  const comVaga = cons.data!.filter((c) => !c.full && c.id !== atual?.id)
  const faseReal: Fase = !atual && fase === 'idle' ? 'lista' : fase

  if (faseReal === 'ok' && novo)
    return (
      <Card className="flex flex-col items-center gap-3.5 rounded-[24px] px-6 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-verde-600 text-white">
          <Check size={38} strokeWidth={3} />
        </span>
        <div className="text-[22px] font-extrabold">Pronto! Agora você indica com {novo.primeiroNome}.</div>
        <div className="text-[14px] text-ink-600">Seus QR Codes continuam os mesmos. Os novos clientes vão direto para {novo.primeiroNome}.</div>
        <Button variant="dark" size="md" onClick={() => setFase('idle')}>
          Ver meu consultor
        </Button>
      </Card>
    )

  if (faseReal === 'confirma' && novo)
    return (
      <Card className="flex flex-col gap-[18px] rounded-[24px] p-6">
        <div className="text-[22px] font-extrabold tracking-[-0.025em]">{atual ? 'Confirmar troca?' : 'Confirmar consultor?'}</div>
        <div className="flex items-center justify-center gap-2.5">
          {atual && (
            <>
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <Avatar nome={atual.nome_exibicao} foto={atual.foto_url} size={56} className="opacity-55" />
                <span className="text-center text-[13px] font-bold text-ink-600">{atual.nome_exibicao}</span>
              </div>
              <ArrowRight size={28} className="text-verde-600" />
            </>
          )}
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <Avatar nome={novo.nome_exibicao} foto={novo.foto_url} size={56} className="outline outline-[3px] outline-offset-2 outline-verde-600" />
            <span className="text-center text-[13px] font-extrabold">{novo.nome_exibicao}</span>
          </div>
        </div>
        <ul className="m-0 pl-[18px] text-[14px] leading-[1.7] text-ink-800">
          <li>Seus QR Codes continuam os mesmos.</li>
          <li>Novos leads vão para {novo.primeiroNome} a partir de agora.</li>
          {atual && (
            <li>
              {funil.data?.leads_andamento ?? 0} {funil.data?.leads_andamento === 1 ? 'lead em andamento segue' : 'leads em andamento seguem'} com {atual.primeiroNome}.
            </li>
          )}
        </ul>
        <div className="flex gap-2">
          <Button variant="outline" size="form" className="flex-1" onClick={() => setFase('lista')}>
            Voltar
          </Button>
          <Button variant="primary" size="form" className="flex-1 font-extrabold" disabled={trocar.isPending} onClick={() => trocar.mutate(novo.id)}>
            {trocar.isPending && <Loader2 size={18} className="animate-spin" />}
            {atual ? 'Confirmar troca' : 'Confirmar'}
          </Button>
        </div>
      </Card>
    )

  if (faseReal === 'lista')
    return (
      <>
        {atual && (
          <button type="button" onClick={() => setFase('idle')} className="flex cursor-pointer items-center gap-1.5 self-start text-[13px] font-bold text-ink-600">
            <ArrowLeft size={18} />
            Cancelar
          </button>
        )}
        <div>
          <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.03em]">{atual ? 'Escolha o novo consultor' : 'Escolha seu consultor'}</h1>
          <div className="text-[14px] text-ink-600">Mostrando só quem tem vaga, do mais quente para o mais frio. A temperatura mostra se o consultor registra as vendas e repassa os indicadores.</div>
        </div>
        {comVaga.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => (setNovo(c), setFase('confirma'))}
            className="flex cursor-pointer flex-col gap-2.5 rounded-[18px] border border-ink-200 bg-white px-4 py-3.5 text-left hover:border-verde-600"
          >
            <div className="flex items-center gap-3">
              <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-extrabold">
                  {c.nome_exibicao}
                  <TemperaturaBadge valor={c.temperatura} small />
                </div>
                <div className="text-[12px] text-ink-600">
                  #{c.rank} · {c.cidade} · {c.conv}% conversão
                </div>
              </div>
              <ChevronRight size={22} className="text-ink-400" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full" style={{ width: `${c.pct}%`, background: c.barColor }} />
              </div>
              <span className="text-[12px] font-bold" style={{ color: c.barColor }}>
                {c.ocupacao}/{c.max_indicadores} · {c.vagaLabel}
              </span>
            </div>
          </button>
        ))}
        {!comVaga.length && <div className="text-[14px] text-ink-600">Nenhum consultor com vaga no momento.</div>}
      </>
    )

  // idle com consultor
  const c = atual!
  const zap = zapConsultor.data ? linkWhatsApp(zapConsultor.data, `Olá! Sou ${p.nome}, indicador(a) da Geralindica, e quero falar com ${c.nome_exibicao}.`) : undefined
  return (
    <>
      <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.03em]">Meu consultor</h1>
      <Card className="flex flex-col gap-[18px] rounded-[24px] p-[22px]">
        <div className="flex items-center gap-4">
          <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={72} rounded="xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap gap-1.5">
              <TemperaturaBadge valor={c.temperatura} small />
              {c.hot && <HotBadge small />}
              <Pill className="bg-ink-950 px-[9px] py-0.5 text-[11px] text-white">#{c.rank} ranking</Pill>
            </div>
            <div className="text-[20px] font-extrabold">{c.nome_exibicao}</div>
            <div className="text-[13px] text-ink-600">
              {c.cidade}
              {vinculo.data!.consultor_desde && ` · com você desde ${dataBR(vinculo.data!.consultor_desde)}`}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [`${c.conv}%`, 'conversão'],
            [String(funil.data?.fechados ?? '–'), 'seus fechados'],
            [c.nota ? String(c.nota).replace('.', ',') : '–', 'avaliação'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-[14px] bg-ink-50 p-3">
              <div className="text-[20px] font-extrabold">{v}</div>
              <div className="text-[12px] text-ink-600">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={zap}
            target="_blank"
            rel="noreferrer"
            className="flex h-[46px] min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-verde-600 text-[14px] font-extrabold text-white hover:bg-verde-700"
          >
            <MessageCircle size={19} />
            Falar no WhatsApp
          </a>
          <Button variant="outline" size="md" className="min-w-[140px] flex-1 font-extrabold" onClick={() => setFase('lista')}>
            <ArrowLeftRight size={19} />
            Trocar de consultor
          </Button>
        </div>
      </Card>
      <div className="flex items-start gap-2.5 rounded-2xl bg-azul-bg px-4 py-3.5 text-[13px] font-semibold leading-[1.5] text-azul-fg">
        <Info size={20} className="shrink-0" />
        Portabilidade livre: você pode trocar quando quiser, desde que o novo consultor tenha vaga. Leads já em andamento continuam com o consultor atual.
      </div>
      <Avaliar consultor={c} indicadorId={p.id} />
    </>
  )
}

function Avaliar({ consultor, indicadorId }: { consultor: Consultor; indicadorId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const avs = useAvaliacoes(consultor.id)
  const [estrelas, setEstrelas] = useState(5)
  const [texto, setTexto] = useState('')
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('avaliacoes').insert({ consultor_id: consultor.id, indicador_id: indicadorId, estrelas, texto: texto.trim(), autor: '—' })
      if (error) throw error
    },
    onSuccess: () => {
      setTexto('')
      qc.invalidateQueries({ queryKey: ['avaliacoes', consultor.id] })
      toast('Avaliação publicada no perfil do consultor.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  return (
    <Card className="flex flex-col gap-3 rounded-[20px] p-5">
      <span className="text-[16px] font-extrabold">Avalie {consultor.primeiroNome}</span>
      <div className="flex gap-1" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={estrelas === n} aria-label={`${n} estrelas`} onClick={() => setEstrelas(n)} className="cursor-pointer p-0.5">
            <Star size={26} className={n <= estrelas ? 'fill-ambar-solid text-ambar-solid' : 'text-ink-200'} />
          </button>
        ))}
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={400}
        rows={3}
        placeholder="Como tem sido o atendimento para os clientes que você indica?"
        className="rounded-[12px] border border-ink-200 px-3.5 py-3 text-[15px] outline-none focus:border-verde-500 focus:ring-[3px] focus:ring-verde-500/20"
      />
      <Button variant="dark" size="md" className="self-start" disabled={texto.trim().length < 10 || enviar.isPending} onClick={() => enviar.mutate()}>
        Publicar avaliação
      </Button>
      {!!avs.data?.length && <div className="text-[12px] text-ink-600">{avs.data.length} avaliações públicas no perfil.</div>}
    </Card>
  )
}
