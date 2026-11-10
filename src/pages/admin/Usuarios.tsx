import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Minus, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { abrirArquivo } from '@/components/painel/Contrato'
import { supabase, mensagemErro } from '@/lib/supabase'
import { corVagas } from '@/lib/negocio'
import type { ConsultorRow } from '@/lib/types'
import { AtivoBadge, GovBadge } from '@/components/ui/badges'
import { Avatar, Card, Segmentado } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'

type ConsAdmin = ConsultorRow & { p: { email: string | null; habilitacao_arquivo: string | null; suspenso_em: string | null } | null }
type IndAdmin = { id: string; nome: string; perfil: string | null; tipo_pessoa: string; consultor: string | null; contrato_etapa: string | null; canais: number; ativo: boolean; suspenso_em: string | null }

export function Usuarios() {
  const [aba, setAba] = useState<'con' | 'ind'>('con')
  const [busca, setBusca] = useState('')
  const qc = useQueryClient()
  const toast = useToast()

  const cons = useQuery({
    queryKey: ['adm', 'cons'],
    queryFn: async () => {
      const [k, c] = await Promise.all([
        supabase.from('consultores').select('*, p:profiles(email, habilitacao_arquivo, suspenso_em)').order('vendas', { ascending: false }),
        supabase.from('contratos').select('parte_id, etapa').eq('tipo', 'consultor').neq('etapa', 'encerrado'),
      ])
      if (k.error) throw k.error
      if (c.error) throw c.error
      const etapas = new Map(((c.data ?? []) as { parte_id: string; etapa: string }[]).map((x) => [x.parte_id, x.etapa]))
      return ((k.data ?? []) as ConsAdmin[]).map((x) => ({ ...x, etapa: etapas.get(x.id) ?? null }))
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
      qc.setQueryData<(ConsAdmin & { etapa: string | null })[]>(['adm', 'cons'], (old) => old?.map((c) => (c.id === id ? { ...c, max_indicadores: Math.min(30, Math.max(c.ocupacao, max)) } : c)))
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
                <span>Contrato e habilitação</span>
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
                        <div className="flex items-center gap-2 text-[12px] text-ink-600">
                          <span className="truncate">{c.cidade}</span>
                          {c.p?.suspenso_em ? <Remover id={c.id} suspenso /> : <AprovarConsultor id={c.id} aprovado={c.aprovado} />}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[12px]">{c.susep ?? '—'}</span>
                    <div className="flex items-center gap-1.5">
                      <Link to="/admin/contratos" title="Abrir contratos">
                        <GovBadge etapa={c.etapa} />
                      </Link>
                      {c.p?.habilitacao_arquivo ? (
                        <button
                          type="button"
                          title="Ver comprovante de habilitação (cláusula 2.3)"
                          aria-label="Ver comprovante de habilitação"
                          onClick={() => abrirArquivo(c.p!.habilitacao_arquivo!).catch((e) => toast(mensagemErro(e), 'erro'))}
                          className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-ink-200 bg-white text-verde-700 hover:bg-ink-50"
                        >
                          <BadgeCheck size={15} />
                        </button>
                      ) : (
                        <span title="Ainda não enviou o comprovante de habilitação" className="text-[11px] font-bold text-ink-400">sem habilitação</span>
                      )}
                    </div>
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
                  <div className="flex items-center gap-2 truncate text-[12px] text-ink-600">
                    {i.perfil ?? '—'}
                    <Remover id={i.id} suspenso={!!i.suspenso_em} />
                  </div>
                </div>
                <span className="font-mono text-[12px] font-semibold">{i.tipo_pessoa}</span>
                <span className="truncate">{i.consultor ?? <span className="text-ink-400">Sem consultor</span>}</span>
                <Link to="/admin/contratos" title="Abrir contratos">
                  <GovBadge etapa={i.contrato_etapa} />
                </Link>
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

/** Tira do site (suspende, encerra contratos) ou reativa. */
function Remover({ id, suspenso }: { id: string; suspenso: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const m = useMutation({
    mutationFn: async () => {
      if (suspenso) {
        const { error } = await supabase.rpc('admin_reativar_usuario', { p_usuario: id })
        if (error) throw error
        return 'Reativado. Consultor precisa ser aprovado de novo e assinar outro contrato.'
      }
      const motivo = window.prompt('Motivo (a pessoa vai ver):', 'Descumprimento do contrato')
      if (motivo === null) return null
      const { error } = await supabase.rpc('admin_remover_usuario', { p_usuario: id, p_motivo: motivo })
      if (error) throw error
      return 'Removido do site. Contratos encerrados.'
    },
    onSuccess: (msg) => {
      if (!msg) return
      toast(msg)
      qc.invalidateQueries({ queryKey: ['adm'] })
      qc.invalidateQueries({ queryKey: ['consultores'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  return (
    <button type="button" disabled={m.isPending} onClick={() => m.mutate()} className={suspenso ? 'shrink-0 cursor-pointer rounded-full bg-vermelho-bg px-2 py-0.5 font-bold text-vermelho-fg' : 'shrink-0 cursor-pointer font-bold text-ink-400 hover:text-vermelho-fg'}>
      {suspenso ? 'Suspenso · Reativar' : 'Remover'}
    </button>
  )
}

/** Consultor novo só entra na vitrine e recebe indicadores depois de aprovado aqui. */
function AprovarConsultor({ id, aprovado }: { id: string; aprovado: boolean }) {
  const qc = useQueryClient()
  const toast = useToast()
  const m = useMutation({
    mutationFn: async (valor: boolean) => {
      const { error } = await supabase.rpc('admin_aprovar_consultor', { p_consultor: id, p_aprovado: valor })
      if (error) throw error
      return valor
    },
    onSuccess: (valor) => {
      toast(valor ? 'Consultor aprovado. Ele já aparece na vitrine.' : 'Aprovação retirada. O consultor saiu da vitrine.')
      qc.invalidateQueries({ queryKey: ['adm'] })
      qc.invalidateQueries({ queryKey: ['consultores'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  if (aprovado)
    return (
      <button type="button" disabled={m.isPending} onClick={() => m.mutate(false)} className="shrink-0 cursor-pointer font-bold text-ink-400 hover:text-vermelho-fg">
        Suspender
      </button>
    )
  return (
    <button
      type="button"
      disabled={m.isPending}
      onClick={() => m.mutate(true)}
      className="shrink-0 cursor-pointer rounded-full bg-ambar-bg px-2 py-0.5 font-bold text-ambar-fg hover:bg-verde-bg hover:text-verde-fg"
    >
      Aguardando · Aprovar
    </button>
  )
}
