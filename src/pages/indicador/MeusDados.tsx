import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth, usePerfil } from '@/auth/AuthProvider'
import { cnpjValido, formatarCNPJ } from '@/lib/negocio'
import type { TipoPessoa } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Card, Segmentado } from '@/components/painel/comum'
import { useToast } from '@/components/ui/feedback'

/** Dados do indicador: PF ou PJ (cadastro). O imposto da conta é o do consultor. O Pix é combinado direto com ele. */
export function MeusDados() {
  const p = usePerfil()
  const { refreshProfile } = useAuth()
  const toast = useToast()
  const [cnpj, setCnpj] = useState(p.tipo_pessoa === 'PJ' ? (p.documento ?? '') : '')
  const [querPJ, setQuerPJ] = useState(false)

  const salvar = useMutation({
    mutationFn: async (dados: { tipo_pessoa: TipoPessoa; documento?: string }) => {
      const { error } = await supabase.from('profiles').update(dados).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      setQuerPJ(false)
      toast('Dados atualizados.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  return (
    <>
      <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.03em]">Meus dados</h1>

      <Card className="flex flex-col gap-3 rounded-[20px] p-[18px]">
        <span className="text-[16px] font-extrabold">Como você recebe</span>
        <Segmentado
          valor={querPJ ? 'PJ' : p.tipo_pessoa}
          onChange={(v) => {
            if (v === 'PF') {
              setQuerPJ(false)
              if (p.tipo_pessoa !== 'PF') salvar.mutate({ tipo_pessoa: 'PF' })
            } else if (p.tipo_pessoa !== 'PJ') setQuerPJ(true)
          }}
          opcoes={[
            { v: 'PF', label: 'Pessoa física' },
            { v: 'PJ', label: 'Pessoa jurídica' },
          ]}
        />
        {querPJ && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!cnpjValido(cnpj)) return toast('Informe um CNPJ válido.', 'erro')
              salvar.mutate({ tipo_pessoa: 'PJ', documento: cnpj })
            }}
          >
            <Field label="CNPJ" value={cnpj} inputMode="numeric" onChange={(e) => setCnpj(formatarCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
            <Button type="submit" variant="primary" size="form" disabled={salvar.isPending}>
              Salvar como PJ
            </Button>
          </form>
        )}
        <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
          Isso não muda o seu valor: o imposto descontado antes da divisão é o do consultor, porque é ele quem recebe do cliente.
        </p>
      </Card>

      <div className="flex items-start gap-2.5 rounded-[16px] bg-ink-50 px-4 py-3.5 text-[13px] leading-[1.55] text-ink-600">
        <Info size={18} className="mt-px shrink-0" />
        <span>
          A Geralindica não faz pagamentos. Depois que a entrevista de saúde do cliente é aprovada, o seu consultor manda a sua parte por Pix. Combine a chave Pix direto com ele.
        </span>
      </div>
    </>
  )
}
