import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Minus, Plus, Search, X } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { corVagas } from '@/lib/negocio'
import type { ConsultorRow } from '@/lib/types'
import { AtivoBadge, GovBadge } from '@/components/ui/badges'
import { Avatar, Card, Segmentado } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'

type Contrato = { contrato_assinado_em: string | null; contrato_enviado_em: string | null; contrato_arquivo: string | null }
type ConsAdmin = ConsultorRow & { p: (Contrato & { email: string | null }) | null }
type IndAdmin = Contrato & { id: string; nome: string; perfil: string | null; tipo_pessoa: string; consultor: string | null; canais: number; ativo: boolean }

export function Usuarios() {
  const [aba, setAba] = useState<'con' | 'ind'>('con')
  const [busca, setBusca] = useState('')
  const qc = useQueryClient()
  const toast = useToast()

  const cons = useQuery({
    queryKey: ['adm', 'cons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultores').select('*, p:profiles(contrato_assinado_em, contrato_enviado_em, contrato_arquivo, email)').order('vendas', { ascending: false })
      if (error) throw error
      return (data ?? []) as ConsAdmin[]
    },
  })
  const inds = useQuery({
    queryKey: ['adm', 'inds'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_indicadores')
      if (error) throw error
      return ((data ?? []) as IndAdmin[]).map((i) => ({ ...i, canais: Number(i.canais) }))
    },
  })

  const limite = useMutation({
    mutationFn: async ({ id, max }: { id: string; max: number }) => {
      const { error } = await supabase.rpc('definir_limite_vagas', { p_consultor: id, p_max: max })
      if (error) throw error
    },
    onMutate: async ({ id, max }) => {
      qc.setQueryData<ConsAdmin[]>(['adm', 'cons'], (old) => old?.map((c) => (c.id === id ? { ...c, max_indicadores: Math.min(30, Math.max(c.ocupacao, max)) } : c)))
    },
    onError: (e) => {
      toast(mensagemErro(e), 'erro')
      qc.invalidateQueries({ queryKey: ['adm', 'cons'] })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['consultores'] }),
  })

  const q = busca.trim().toLowerCase()
  const consF = useMemo(() => (cons.data ?? []).filter((c) => !q || c.nome_exibicao.toLowerCase().includes(q) || c.cidade?.toLowerCase().includes(q)), [cons.data, q])
  const indsF = useMemo(() => (inds.data ?? []).filter((i) => !q || i.nome.toLowerCase().includes(q) || i.consultor?.toLowerCase().includes(q)), [inds.data, q])

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Usuários</h1>
        <Segmentado
          valor={aba}
          onChange={setAba}
          className="w-auto"
          opcoes={[
            { v: 'con', label: `Consultores · ${cons.data?.length ?? '…'}` },
            { v: 'ind', label: `Indicadores · ${inds.data?.length ?? '…'}` },
          ]}
        />
        <label className="ml-auto flex h-10 w-full items-center gap-2 rounded-[12px] border border-ink-200 bg-white px-3 sm:w-[260px]">
          <Search size={18} className="text-ink-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" aria-label="Buscar usuários" />
        </label>
      </div>

      {aba === 'con' ? (
        cons.isLoading ? (
          <Carregando />
        ) : cons.error ? (
          <ErroBox erro={cons.error} onRetry={() => cons.refetch()} />
        ) : (
          <Card className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_210px_minmax(0,1.2fr)_150px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
                <span>Consultor</span>
                <span>SUSEP</span>
                <span>Contrato Gov.br</span>
                <span>Vagas ocupadas</span>
                <span>Limite de vagas</span>
              </div>
              {consF.map((c) => {
                const vagas = c.max_indicadores - c.ocupacao
                const cor = corVagas(vagas <= 0, vagas)
                return (
                  <div key={c.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_210px_minmax(0,1.2fr)_150px] items-center gap-3 border-b border-ink-100 px-5 py-3 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={36} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold">
                          {c.nome_exibicao}
                          {!c.publicado && <span className="ml-1.5 text-[11px] font-bold text-ink-400">(oculto)</span>}
                        </div>
                        <div className="truncate text-[12px] text-ink-600">{c.cidade}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[12px]">{c.susep ?? '—'}</span>
                    <ContratoCelula id={c.id} c={c.p} />
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full" style={{ width: `${Math.min(100, (c.ocupacao / c.max_indicadores) * 100)}%`, background: cor }} />
                      </div>
                      <span className="min-w-[44px] text-[13px] font-bold">
                        {c.ocupacao}/{c.max_indicadores}
                      </span>
                    </div>
                    <div className="flex w-[120px] items-center overflow-hidden rounded-[10px] border border-ink-200">
                      <button
                        type="button"
                        aria-label="Diminuir limite"
                        disabled={c.max_indicadores <= Math.max(1, c.ocupacao)}
                        onClick={() => limite.mutate({ id: c.id, max: c.max_indicadores - 1 })}
                        className="flex h-[34px] w-9 cursor-pointer items-center justify-center bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="flex-1 text-center text-[14px] font-extrabold">{c.max_indicadores}</span>
                      <button
                        type="button"
                        aria-label="Aumentar limite"
                        disabled={c.max_indicadores >= 30}
                        onClick={() => limite.mutate({ id: c.id, max: c.max_indicadores + 1 })}
                        className="flex h-[34px] w-9 cursor-pointer items-center justify-center bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      ) : inds.isLoading ? (
        <Carregando />
      ) : inds.error ? (
        <ErroBox erro={inds.error} onRetry={() => inds.refetch()} />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_70px_minmax(0,1.2fr)_210px_90px_100px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
              <span>Indicador</span>
              <span>Tipo</span>
              <span>Consultor</span>
              <span>Contrato Gov.br</span>
              <span>Canais</span>
              <span>Status</span>
            </div>
            {indsF.slice(0, 300).map((i) => (
              <div key={i.id} className="grid grid-cols-[minmax(0,1.4fr)_70px_minmax(0,1.2fr)_210px_90px_100px] items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate font-bold">{i.nome}</div>
                  <div className="truncate text-[12px] text-ink-600">{i.perfil ?? '—'}</div>
                </div>
                <span className="font-mono text-[12px] font-semibold">{i.tipo_pessoa}</span>
                <span className="truncate">{i.consultor ?? <span className="text-ink-400">Sem consultor</span>}</span>
                <ContratoCelula id={i.id} c={i} />
                <span className="font-bold">{i.canais}</span>
                <AtivoBadge ativo={i.ativo} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

/** Contrato Gov.br: a pessoa envia o PDF assinado e o admin confere aqui. */
function ContratoCelula({ id, c }: { id: string; c: Contrato | null }) {
  const qc = useQueryClient()
  const toast = useToast()
  const conferir = useMutation({
    mutationFn: async (aprovado: boolean) => {
      const { error } = await supabase.rpc('admin_conferir_contrato', { p_usuario: id, p_aprovado: aprovado })
      if (error) throw error
      return aprovado
    },
    onSuccess: (aprovado) => {
      toast(aprovado ? 'Contrato aprovado.' : 'Contrato recusado. A pessoa vai ver o pedido para enviar de novo.')
      qc.invalidateQueries({ queryKey: ['adm'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const abrir = async () => {
    const { data, error } = await supabase.storage.from('contratos').createSignedUrl(c!.contrato_arquivo!, 600)
    if (error) return toast(mensagemErro(error), 'erro')
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const btn = 'flex size-7 cursor-pointer items-center justify-center rounded-lg border border-ink-200 bg-white hover:bg-ink-50 disabled:opacity-40'
  return (
    <div className="flex items-center gap-1.5">
      <GovBadge assinado={!!c?.contrato_assinado_em} enviado={!!c?.contrato_enviado_em} />
      {c?.contrato_arquivo && (
        <button type="button" onClick={abrir} title="Ver o PDF assinado" aria-label="Ver o PDF assinado" className={btn}>
          <FileText size={15} />
        </button>
      )}
      {c?.contrato_arquivo && !c.contrato_assinado_em && (
        <>
          <button type="button" disabled={conferir.isPending} onClick={() => conferir.mutate(true)} title="Aprovar contrato" aria-label="Aprovar contrato" className={`${btn} text-verde-700`}>
            <Check size={15} strokeWidth={3} />
          </button>
          <button type="button" disabled={conferir.isPending} onClick={() => conferir.mutate(false)} title="Recusar contrato" aria-label="Recusar contrato" className={`${btn} text-vermelho-fg`}>
            <X size={15} strokeWidth={3} />
          </button>
        </>
      )}
    </div>
  )
}
