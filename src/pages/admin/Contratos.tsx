import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, ExternalLink, FileText, Undo2 } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { Card, Segmentado, TituloPagina } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { GovBadge } from '@/components/ui/badges'
import { BotaoEnviar, abrirArquivo, dadosDoContrato, subirArquivo } from '@/components/painel/Contrato'
import { ASSINADOR_GOVBR, baixarPdfContrato } from '@/lib/contratos'
import { dataBR, formatarCPF } from '@/lib/negocio'

type ContratoAdm = {
  id: string
  tipo: 'indicador' | 'consultor'
  etapa: string
  parte_id: string
  parte: string
  consultor: string
  arquivo: string | null
  observacao: string | null
  created_at: string
  parte_assinou_em: string | null
  consultor_assinou_em: string | null
  vigente_em: string | null
}

export function Contratos() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [aba, setAba] = useState<'conferir' | 'todos'>('conferir')
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['adm', 'contratos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_contratos')
      if (error) throw error
      return (data ?? []) as ContratoAdm[]
    },
  })
  const atualizar = () => qc.invalidateQueries({ queryKey: ['adm'] })
  const concluir = useMutation({
    mutationFn: async ({ id, f }: { id: string; f?: File }) => {
      setEnviandoId(id)
      const caminho = f ? await subirArquivo(profile!.id, 'contrato-final', f) : null
      const { error } = await supabase.rpc('admin_concluir_contrato', { p_contrato: id, p_arquivo: caminho })
      if (error) throw error
    },
    onSuccess: () => {
      toast('Contrato vigente.')
      atualizar()
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
    onSettled: () => setEnviandoId(null),
  })
  const devolver = useMutation({
    mutationFn: async (id: string) => {
      const motivo = window.prompt('O que precisa corrigir? A pessoa vai ver esta mensagem.', 'O arquivo enviado não tem a assinatura do Gov.br.')
      if (motivo === null) return false
      const { error } = await supabase.rpc('contrato_recusar', { p_contrato: id, p_motivo: motivo })
      if (error) throw error
      return true
    },
    onSuccess: (ok) => {
      if (ok) {
        toast('Devolvido para assinar de novo.')
        atualizar()
      }
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const erro = (e: unknown) => toast(mensagemErro(e), 'erro')
  const lista = (q.data ?? []).filter((c) => aba === 'todos' || c.etapa === 'geralindica')

  return (
    <>
      <TituloPagina titulo="Contratos">
        <Segmentado
          valor={aba}
          onChange={setAba}
          className="w-auto"
          opcoes={[
            { v: 'conferir', label: `Para conferir · ${(q.data ?? []).filter((c) => c.etapa === 'geralindica').length}` },
            { v: 'todos', label: 'Todos' },
          ]}
        />
      </TituloPagina>
      <p className="m-0 text-[14px] leading-[1.55] text-ink-600">
        <b>Indicador:</b> assina o indicador, depois o consultor (contratante) e por último as 2 testemunhas, aqui. <b>Consultor:</b> assina o consultor e depois a Geralindica (contratante). Abra o PDF, colha as assinaturas que faltam no
        assinador.iti.br e envie a versão final; ou conclua sem trocar o arquivo.
      </p>
      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <ErroBox erro={q.error} onRetry={() => q.refetch()} />
      ) : !lista.length ? (
        <Vazio titulo={aba === 'conferir' ? 'Nada para conferir' : 'Nenhum contrato'} texto="Os contratos aparecem aqui quando as partes assinam." />
      ) : (
        <Card className="overflow-hidden">
          {lista.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2.5 border-b border-ink-100 px-4 py-3 last:border-b-0">
              <div className="min-w-[220px] flex-1">
                <div className="text-[14px] font-bold">
                  {c.parte} <span className="font-semibold text-ink-400">· {c.tipo === 'indicador' ? `indicador de ${c.consultor}` : 'consultor'}</span>
                </div>
                <div className="text-[12px] text-ink-600">
                  {c.parte_assinou_em ? `Parte assinou em ${dataBR(c.parte_assinou_em)}` : 'Parte ainda não assinou'}
                  {c.tipo === 'indicador' && (c.consultor_assinou_em ? ` · consultor em ${dataBR(c.consultor_assinou_em)}` : '')}
                  {c.vigente_em && ` · vigente desde ${dataBR(c.vigente_em)}`}
                </div>
              </div>
              <GovBadge etapa={c.etapa} />
              <button type="button" title="Baixar o PDF preenchido (sem assinaturas)" onClick={() => dadosDoContrato(c.id).then(baixarPdfContrato).catch(erro)} className={buttonVariants({ variant: 'outline', size: 'md', className: 'h-9 px-3 text-[13px]' })}>
                <Download size={15} />
                Original
              </button>
              {c.arquivo && (
                <button type="button" onClick={() => abrirArquivo(c.arquivo!).catch(erro)} className={buttonVariants({ variant: 'outline', size: 'md', className: 'h-9 px-3 text-[13px]' })}>
                  <FileText size={15} />
                  Assinado
                </button>
              )}
              {c.etapa === 'geralindica' && (
                <>
                  <a href={ASSINADOR_GOVBR} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'gov', size: 'md', className: 'h-9 px-3 text-[13px]' })}>
                    <ExternalLink size={15} />
                    Gov.br
                  </a>
                  <BotaoEnviar rotulo="Enviar final e concluir" enviando={concluir.isPending && enviandoId === c.id} onArquivo={(f) => concluir.mutate({ id: c.id, f })} />
                  <Button variant="outline" size="md" className="h-9 px-3 text-[13px]" disabled={concluir.isPending} onClick={() => concluir.mutate({ id: c.id })}>
                    <Check size={15} />
                    Concluir
                  </Button>
                </>
              )}
              {(c.etapa === 'geralindica' || c.etapa === 'consultor') && (
                <button type="button" onClick={() => devolver.mutate(c.id)} className="flex cursor-pointer items-center gap-1 text-[13px] font-bold text-ink-400 hover:text-vermelho-fg">
                  <Undo2 size={14} />
                  Devolver
                </button>
              )}
              {c.observacao && <div className="w-full text-[12px] font-semibold text-ambar-fg">Devolvido: {c.observacao}</div>}
            </div>
          ))}
        </Card>
      )}
      <Testemunhas />
    </>
  )
}

type Config = { testemunha1_nome: string | null; testemunha1_cpf: string | null; testemunha1_email: string | null; testemunha2_nome: string | null; testemunha2_cpf: string | null; testemunha2_email: string | null }

/** As 2 testemunhas que saem impressas em todo contrato de indicador (cláusula 12.1). */
function Testemunhas() {
  const toast = useToast()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['adm', 'testemunhas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_contrato').select('testemunha1_nome, testemunha1_cpf, testemunha1_email, testemunha2_nome, testemunha2_cpf, testemunha2_email').eq('id', 1).single()
      if (error) throw error
      return data as Config
    },
  })
  const [f, setF] = useState<Config | null>(null)
  useEffect(() => {
    if (q.data && !f) setF(q.data)
  }, [q.data, f])
  const salvar = useMutation({
    mutationFn: async () => {
      const limpo = Object.fromEntries(Object.entries(f!).map(([k, v]) => [k, v?.trim() || null]))
      const { error } = await supabase.from('config_contrato').update(limpo).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Testemunhas salvas. Os próximos PDFs já saem com elas.')
      qc.invalidateQueries({ queryKey: ['adm', 'testemunhas'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  if (!f) return null
  const campo = (k: keyof Config, label: string, cpf = false) => (
    <Field label={label} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: cpf ? formatarCPF(e.target.value) : e.target.value })} />
  )
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="m-0 text-[17px] font-extrabold">Testemunhas do contrato do indicador</h2>
      <p className="m-0 text-[13px] text-ink-600">Saem impressas em todo contrato novo. Elas assinam no Gov.br na última etapa, antes de você concluir. Não podem ser o indicador nem o consultor do contrato.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {campo('testemunha1_nome', 'Testemunha 1 · nome')}
        {campo('testemunha1_cpf', 'CPF', true)}
        {campo('testemunha1_email', 'E-mail')}
        {campo('testemunha2_nome', 'Testemunha 2 · nome')}
        {campo('testemunha2_cpf', 'CPF', true)}
        {campo('testemunha2_email', 'E-mail')}
      </div>
      <Button variant="primary" className="self-start" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
        Salvar testemunhas
      </Button>
    </Card>
  )
}
