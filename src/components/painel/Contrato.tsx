import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Clock, Download, ExternalLink, FileSignature, Loader2, Undo2, Upload } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'
import { GovBadge } from '@/components/ui/badges'
import { Card } from '@/components/painel/comum'
import { ASSINADOR_GOVBR, baixarPdfContrato, camposFaltando } from '@/lib/contratos'
import { dataBR } from '@/lib/negocio'
import type { DadosContrato } from '@/lib/types'
import { cn } from '@/lib/utils'

const PASSO = 'flex size-7 shrink-0 items-center justify-center rounded-full bg-azul-fg text-[13px] font-extrabold text-white'

/** Envia um arquivo para a pasta da pessoa no bucket "contratos" e devolve o caminho. */
export async function subirArquivo(usuario: string, nome: string, arquivo: File, tipos = ['application/pdf']) {
  if (!tipos.includes(arquivo.type)) throw new Error(tipos.length === 1 ? 'Envie o PDF assinado.' : 'Envie PDF, JPG ou PNG.')
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('O arquivo passa de 10 MB.')
  const ext = arquivo.type === 'application/pdf' ? 'pdf' : arquivo.type === 'image/png' ? 'png' : 'jpg'
  const caminho = `${usuario}/${nome}-${Date.now()}.${ext}`
  const up = await supabase.storage.from('contratos').upload(caminho, arquivo, { contentType: arquivo.type })
  if (up.error) throw up.error
  return caminho
}

export async function abrirArquivo(caminho: string) {
  const { data, error } = await supabase.storage.from('contratos').createSignedUrl(caminho, 600)
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener')
}

export async function dadosDoContrato(id: string) {
  const { data, error } = await supabase.rpc('contrato_dados', { p_contrato: id })
  if (error) throw error
  return data as DadosContrato
}

export function useMeuContrato() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['contrato', 'meu', profile?.id],
    enabled: !!profile && profile.papel !== 'admin',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meu_contrato')
      if (error) throw error
      return (data ?? null) as DadosContrato | null
    },
  })
}

/** Botão de escolher arquivo que já envia. */
export function BotaoEnviar({ rotulo, enviando, onArquivo, tipos = 'application/pdf', variante = 'primary' }: { rotulo: string; enviando: boolean; onArquivo: (f: File) => void; tipos?: string; variante?: 'primary' | 'dark' }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <label className={cn(buttonVariants({ variant: variante, size: 'md', className: 'h-10 cursor-pointer text-[13px]' }), enviando && 'pointer-events-none opacity-60')}>
      {enviando ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
      {enviando ? 'Enviando…' : rotulo}
      <input
        ref={input}
        type="file"
        accept={tipos}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onArquivo(f)
          if (input.current) input.current.value = ''
        }}
      />
    </label>
  )
}

function Faixa({ children, cor = 'azul', icone }: { children: ReactNode; cor?: 'azul' | 'ambar'; icone?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3 text-[14px] font-semibold', cor === 'azul' ? 'bg-azul-bg text-azul-fg' : 'bg-ambar-bg text-ambar-fg')}>
      {icone ?? <Clock size={20} className="shrink-0" />}
      {children}
    </div>
  )
}

/**
 * Contrato do Luis pelo Gov.br (grátis): baixa o PDF já preenchido, assina em assinador.iti.br e envia.
 * Indicador: depois assina o consultor (contratante) e a Geralindica confere com as testemunhas.
 * Consultor: depois a Geralindica (contratante) assina e confere. Fica no topo do painel até ficar vigente.
 */
export function ContratoPendente() {
  const { profile } = useAuth()
  const contrato = useMeuContrato()
  const qc = useQueryClient()
  const toast = useToast()
  const [reenviar, setReenviar] = useState(false)
  const [gerando, setGerando] = useState(false)

  const enviar = useMutation({
    mutationFn: async (arquivo: File) => {
      const caminho = await subirArquivo(profile!.id, 'contrato', arquivo)
      const { error } = await supabase.rpc('contrato_enviar', { p_contrato: contrato.data!.id, p_arquivo: caminho })
      if (error) throw error
    },
    onSuccess: () => {
      setReenviar(false)
      qc.invalidateQueries({ queryKey: ['contrato'] })
      toast(contrato.data?.tipo === 'indicador' ? 'Contrato enviado. Agora o seu consultor assina.' : 'Contrato enviado. Agora a Geralindica assina e confere.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (!profile || profile.papel === 'admin' || profile.suspenso_em) return null
  const habilitacao = profile.papel === 'consultor' && !profile.habilitacao_arquivo ? <EnviarHabilitacao /> : null
  if (contrato.isLoading || contrato.error) return habilitacao
  const d = contrato.data

  if (!d) {
    if (profile.papel !== 'indicador') return habilitacao
    return (
      <Faixa cor="ambar" icone={<FileSignature size={20} className="shrink-0" />}>
        <span className="flex-1">Seu contrato é com o seu consultor. Escolha um consultor para gerar o contrato.</span>
        <Link to="/indicador/consultor" className="text-[13px] font-bold underline">
          Escolher consultor
        </Link>
      </Faixa>
    )
  }
  if (d.etapa === 'vigente') return habilitacao

  if (d.etapa !== 'parte' && !reenviar) {
    const podeReenviar = d.etapa === 'consultor' || (d.etapa === 'geralindica' && d.tipo === 'consultor')
    const texto =
      d.etapa === 'consultor'
        ? `Você assinou em ${dataBR(d.parte_assinou_em!)}. Agora o seu consultor assina o contrato pelo Gov.br.`
        : d.tipo === 'indicador'
          ? 'Você e o seu consultor já assinaram. A Geralindica está conferindo e colhendo as testemunhas.'
          : `Você assinou em ${dataBR(d.parte_assinou_em!)}. Agora a Geralindica assina e confere.`
    return (
      <>
        <Faixa>
          <span className="flex-1">{texto}</span>
          {podeReenviar && (
            <button type="button" onClick={() => setReenviar(true)} className="cursor-pointer text-[13px] font-bold underline">
              Enviar outro arquivo
            </button>
          )}
        </Faixa>
        {habilitacao}
      </>
    )
  }

  const faltaMeu = camposFaltando(d.parte, d.tipo === 'indicador')
  const faltaConsultor = d.tipo === 'indicador' ? camposFaltando(d.consultor) : []
  const baixar = async () => {
    setGerando(true)
    try {
      await baixarPdfContrato(d)
    } catch (e) {
      toast(mensagemErro(e), 'erro')
    } finally {
      setGerando(false)
    }
  }
  const linkDados = profile.papel === 'consultor' ? '/consultor/dados' : '/indicador/dados'

  return (
    <>
      <section className="flex flex-col gap-4 rounded-[18px] border-2 border-azul-fg/25 bg-white p-5" aria-labelledby="contrato-titulo">
        <div className="flex items-center gap-2.5">
          <FileSignature size={22} className="text-azul-fg" />
          <h2 id="contrato-titulo" className="m-0 text-[17px] font-extrabold">
            Assine seu contrato pelo Gov.br
          </h2>
        </div>
        <p className="m-0 text-[14px] leading-[1.55] text-ink-600">
          {d.tipo === 'indicador'
            ? 'É o contrato de parceria com o seu consultor, já preenchido com os dados de vocês dois. Depois de você, ele assina e a Geralindica confere.'
            : 'É o contrato de parceria com a Geralindica, já preenchido com os seus dados. Depois de você, a Geralindica assina.'}{' '}
          Grátis e leva uns 3 minutos com uma conta Gov.br prata ou ouro.
        </p>
        {d.observacao && (
          <div className="flex items-start gap-2 rounded-[12px] bg-ambar-bg px-3 py-2.5 text-[13px] font-semibold text-ambar-fg">
            <Undo2 size={16} className="mt-0.5 shrink-0" />
            Devolvido para assinar de novo: {d.observacao}
          </div>
        )}
        {faltaMeu.length > 0 ? (
          <div className="rounded-[12px] bg-ambar-bg px-3 py-2.5 text-[13px] font-semibold text-ambar-fg">
            Para o contrato sair preenchido, complete em{' '}
            <Link to={linkDados} className="underline">
              Meus dados
            </Link>
            : {faltaMeu.join(', ')}.
          </div>
        ) : faltaConsultor.length > 0 ? (
          <div className="rounded-[12px] bg-ambar-bg px-3 py-2.5 text-[13px] font-semibold text-ambar-fg">
            Falta o seu consultor completar o cadastro dele ({faltaConsultor.join(', ')}). Avise pelo chat em Mensagens.
          </div>
        ) : null}
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
          <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
            <span className="flex items-center gap-2 text-[14px] font-bold">
              <span className={PASSO}>1</span> Baixe o contrato
            </span>
            <button
              type="button"
              disabled={gerando || faltaMeu.length > 0 || faltaConsultor.length > 0}
              onClick={baixar}
              className={buttonVariants({ variant: 'dark', size: 'md', className: 'h-10 text-[13px] disabled:cursor-not-allowed disabled:opacity-50' })}
            >
              {gerando ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              Baixar PDF preenchido
            </button>
          </li>
          <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
            <span className="flex items-center gap-2 text-[14px] font-bold">
              <span className={PASSO}>2</span> Assine no Gov.br
            </span>
            <a href={ASSINADOR_GOVBR} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'gov', size: 'md', className: 'h-10 text-[13px]' })}>
              <ExternalLink size={17} />
              Abrir assinador.iti.br
            </a>
            <span className="text-[12px] leading-[1.45] text-ink-600">Entre com o Gov.br, escolha o PDF, assine e baixe o arquivo assinado.</span>
          </li>
          <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
            <span className="flex items-center gap-2 text-[14px] font-bold">
              <span className={PASSO}>3</span> Envie o PDF assinado
            </span>
            <BotaoEnviar rotulo="Escolher arquivo" enviando={enviar.isPending} onArquivo={(f) => enviar.mutate(f)} />
          </li>
        </ol>
      </section>
      {habilitacao}
    </>
  )
}

/** Cláusula 2.3 do contrato do consultor: comprovante de habilitação ou vínculo com corretora. */
function EnviarHabilitacao() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const m = useMutation({
    mutationFn: async (f: File) => {
      const caminho = await subirArquivo(profile!.id, 'habilitacao', f, ['application/pdf', 'image/jpeg', 'image/png'])
      const { error } = await supabase.rpc('enviar_habilitacao', { p_arquivo: caminho })
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      toast('Comprovante enviado. A Geralindica confere antes de aprovar seu perfil.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  return (
    <Faixa cor="ambar" icone={<BadgeCheck size={20} className="shrink-0" />}>
      <span className="flex-1">Envie a declaração e o comprovante de que você é habilitado(a) ou vinculado(a) a uma corretora (cláusula 2.3 do contrato).</span>
      <BotaoEnviar rotulo="Enviar comprovante" tipos="application/pdf,image/jpeg,image/png" enviando={m.isPending} onArquivo={(f) => m.mutate(f)} variante="dark" />
    </Faixa>
  )
}

type ContratoCarteira = { id: string; indicador_id: string; indicador: string; etapa: string; arquivo: string | null; parte_assinou_em: string | null; vigente_em: string | null; observacao: string | null }

/** Consultor: ele é o CONTRATANTE no contrato de cada indicador e assina depois dele. */
export function ContratosDaCarteira() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['contrato', 'carteira'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contratos_da_carteira')
      if (error) throw error
      return (data ?? []) as ContratoCarteira[]
    },
  })
  const assinar = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: File }) => {
      setEnviandoId(id)
      const caminho = await subirArquivo(profile!.id, 'contrato-indicador', f)
      const { error } = await supabase.rpc('contrato_enviar', { p_contrato: id, p_arquivo: caminho })
      if (error) throw error
    },
    onSuccess: () => {
      toast('Assinado. A Geralindica confere e colhe as testemunhas.')
      qc.invalidateQueries({ queryKey: ['contrato'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
    onSettled: () => setEnviandoId(null),
  })
  const devolver = useMutation({
    mutationFn: async (id: string) => {
      const motivo = window.prompt('O que o indicador precisa corrigir?', 'O arquivo não está assinado pelo Gov.br.')
      if (motivo === null) return false
      const { error } = await supabase.rpc('contrato_recusar', { p_contrato: id, p_motivo: motivo })
      if (error) throw error
      return true
    },
    onSuccess: (ok) => {
      if (!ok) return
      toast('Devolvido. O indicador vai ver o pedido para assinar de novo.')
      qc.invalidateQueries({ queryKey: ['contrato'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const abrir = (c: string) => abrirArquivo(c).catch((e) => toast(mensagemErro(e), 'erro'))
  const itens = q.data ?? []
  if (!itens.length) return null
  const pendentes = itens.filter((c) => c.etapa === 'consultor').length

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <FileSignature size={20} className="text-azul-fg" />
        <h2 className="m-0 text-[17px] font-extrabold">Contratos dos seus indicadores</h2>
        {pendentes > 0 && <span className="rounded-full bg-ambar-bg px-2.5 py-0.5 text-[12px] font-bold text-ambar-fg">{pendentes} para você assinar</span>}
      </div>
      <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
        No contrato de indicação, você é o CONTRATANTE. Quando o indicador assinar, baixe o PDF dele, assine por cima em assinador.iti.br e envie aqui.
      </p>
      <div className="flex flex-col">
        {itens.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2.5 border-t border-ink-100 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold">{c.indicador}</div>
              <div className="text-[12px] text-ink-600">{c.parte_assinou_em ? `Indicador assinou em ${dataBR(c.parte_assinou_em)}` : 'Indicador ainda não assinou'}</div>
            </div>
            <GovBadge etapa={c.etapa} />
            {c.etapa === 'consultor' && c.arquivo && (
              <>
                <button type="button" onClick={() => abrir(c.arquivo!)} className={buttonVariants({ variant: 'outline', size: 'md', className: 'h-10 text-[13px]' })}>
                  <Download size={16} />
                  PDF do indicador
                </button>
                <a href={ASSINADOR_GOVBR} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'gov', size: 'md', className: 'h-10 text-[13px]' })}>
                  <ExternalLink size={16} />
                  Assinar no Gov.br
                </a>
                <BotaoEnviar rotulo="Enviar assinado" enviando={assinar.isPending && enviandoId === c.id} onArquivo={(f) => assinar.mutate({ id: c.id, f })} />
                <button type="button" onClick={() => devolver.mutate(c.id)} className="cursor-pointer text-[13px] font-bold text-ink-400 hover:text-vermelho-fg">
                  Devolver
                </button>
              </>
            )}
            {c.etapa === 'vigente' && c.arquivo && (
              <button type="button" onClick={() => abrir(c.arquivo!)} className="cursor-pointer text-[13px] font-bold text-azul-fg underline">
                Ver contrato
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Meus dados: o que o contrato pede (RG, endereço, celular) e o contrato vigente para baixar. */
export function CardDadosContrato({ comTelefone = true }: { comTelefone?: boolean }) {
  const { profile, refreshProfile } = useAuth()
  const contrato = useMeuContrato()
  const toast = useToast()
  const qc = useQueryClient()
  const [f, setF] = useState({ rg: profile?.rg ?? '', endereco: profile?.endereco ?? '', telefone: profile?.telefone ?? '' })
  const salvar = useMutation({
    mutationFn: async () => {
      const dados: Record<string, string | null> = { rg: f.rg.trim() || null, endereco: f.endereco.trim() || null }
      if (comTelefone) dados.telefone = f.telefone.trim() || null
      const { error } = await supabase.from('profiles').update(dados).eq('id', profile!.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      qc.invalidateQueries({ queryKey: ['contrato'] })
      toast('Dados salvos.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  if (!profile) return null
  const d = contrato.data
  return (
    <Card className="flex flex-col gap-3 rounded-[20px] p-[18px]">
      <span className="text-[16px] font-extrabold">Dados do contrato</span>
      <p className="m-0 text-[13px] leading-[1.5] text-ink-600">Saem no contrato preenchido. Se mudar depois de assinado, o contrato antigo continua valendo.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-bold">
            {profile.tipo_pessoa === 'PJ' ? 'RG do responsável' : 'RG'}
            <input value={f.rg} maxLength={30} onChange={(e) => setF({ ...f, rg: e.target.value })} className="h-12 rounded-[12px] border border-ink-200 px-3 text-[15px] font-medium outline-none focus:border-verde-500" />
          </label>
          {comTelefone && (
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              Celular (WhatsApp)
              <input value={f.telefone} inputMode="tel" onChange={(e) => setF({ ...f, telefone: e.target.value })} className="h-12 rounded-[12px] border border-ink-200 px-3 text-[15px] font-medium outline-none focus:border-verde-500" />
            </label>
          )}
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold">
          Endereço completo
          <input value={f.endereco} maxLength={300} placeholder="Rua, número, bairro, cidade/UF, CEP" onChange={(e) => setF({ ...f, endereco: e.target.value })} className="h-12 rounded-[12px] border border-ink-200 px-3 text-[15px] font-medium outline-none focus:border-verde-500" />
        </label>
        <button type="submit" disabled={salvar.isPending} className={buttonVariants({ variant: 'primary', size: 'form', className: 'self-start' })}>
          Salvar
        </button>
      </form>
      {d && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-[13px]">
          <span className="font-bold">Meu contrato</span>
          <GovBadge etapa={d.etapa} />
          {d.etapa === 'vigente' && d.arquivo && (
            <button type="button" onClick={() => abrirArquivo(d.arquivo!).catch((e) => toast(mensagemErro(e), 'erro'))} className="cursor-pointer font-bold text-azul-fg underline">
              Ver o contrato assinado
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
