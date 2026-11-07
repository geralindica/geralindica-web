import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Clock, Download, ExternalLink, FileSignature, Loader2, Upload } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { buttonVariants } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

const ASSINADOR = 'https://assinador.iti.br'

/**
 * Contrato pelo Gov.br (opção A, grátis): a pessoa baixa o PDF, assina em assinador.iti.br e envia o PDF assinado.
 * Fica no topo do painel até o admin conferir (Admin → Usuários).
 */
export function ContratoPendente() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [reenviar, setReenviar] = useState(false)

  const enviar = useMutation({
    mutationFn: async (arquivo: File) => {
      if (arquivo.type !== 'application/pdf') throw new Error('Envie o PDF do contrato assinado.')
      if (arquivo.size > 10 * 1024 * 1024) throw new Error('O PDF passa de 10 MB.')
      const caminho = `${profile!.id}/contrato-${Date.now()}.pdf`
      const up = await supabase.storage.from('contratos').upload(caminho, arquivo, { contentType: 'application/pdf' })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('enviar_contrato', { p_arquivo: caminho })
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      setReenviar(false)
      toast('Contrato enviado. A Geralindica vai conferir e liberar.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
    onSettled: () => {
      if (input.current) input.current.value = ''
    },
  })

  if (!profile || profile.papel === 'admin' || profile.contrato_assinado_em) return null
  const pdf = profile.papel === 'consultor' ? '/contratos/contrato-consultor.pdf' : '/contratos/contrato-indicador.pdf'
  const seletor = (
    <input
      ref={input}
      type="file"
      accept="application/pdf"
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) enviar.mutate(f)
      }}
    />
  )

  if (profile.contrato_enviado_em && !reenviar)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-azul-bg px-4 py-3 text-[14px] font-semibold text-azul-fg">
        <Clock size={20} className="shrink-0" />
        <span className="flex-1">
          Contrato enviado em {new Date(profile.contrato_enviado_em).toLocaleDateString('pt-BR')}. A Geralindica está conferindo.
        </span>
        <button type="button" onClick={() => setReenviar(true)} className="cursor-pointer text-[13px] font-bold underline">
          Enviar outro arquivo
        </button>
      </div>
    )

  const passo = 'flex size-7 shrink-0 items-center justify-center rounded-full bg-azul-fg text-[13px] font-extrabold text-white'
  return (
    <section className="flex flex-col gap-4 rounded-[18px] border-2 border-azul-fg/25 bg-white p-5" aria-labelledby="contrato-titulo">
      <div className="flex items-center gap-2.5">
        <FileSignature size={22} className="text-azul-fg" />
        <h2 id="contrato-titulo" className="m-0 text-[17px] font-extrabold">
          Assine seu contrato pelo Gov.br
        </h2>
      </div>
      <p className="m-0 text-[14px] leading-[1.55] text-ink-600">
        É grátis e leva uns 3 minutos. Você precisa de uma conta Gov.br nível prata ou ouro (a mesma do app gov.br).
      </p>
      <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
        <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
          <span className="flex items-center gap-2 text-[14px] font-bold">
            <span className={passo}>1</span> Baixe o contrato
          </span>
          <a href={pdf} download className={buttonVariants({ variant: 'dark', size: 'md', className: 'h-10 text-[13px]' })}>
            <Download size={17} />
            Baixar PDF
          </a>
        </li>
        <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
          <span className="flex items-center gap-2 text-[14px] font-bold">
            <span className={passo}>2</span> Assine no Gov.br
          </span>
          <a href={ASSINADOR} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'gov', size: 'md', className: 'h-10 text-[13px]' })}>
            <ExternalLink size={17} />
            Abrir assinador.iti.br
          </a>
          <span className="text-[12px] leading-[1.45] text-ink-600">Entre com o Gov.br, escolha o PDF, assine e baixe o arquivo assinado.</span>
        </li>
        <li className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
          <span className="flex items-center gap-2 text-[14px] font-bold">
            <span className={passo}>3</span> Envie o PDF assinado
          </span>
          <label className={cn(buttonVariants({ variant: 'primary', size: 'md', className: 'h-10 cursor-pointer text-[13px]' }), enviar.isPending && 'pointer-events-none opacity-60')}>
            {enviar.isPending ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
            {enviar.isPending ? 'Enviando…' : 'Escolher arquivo'}
            {seletor}
          </label>
        </li>
      </ol>
    </section>
  )
}
