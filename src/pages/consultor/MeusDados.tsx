import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2, MessageCircle } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth, usePerfil } from '@/auth/AuthProvider'
import { useConfig } from '@/data/queries'
import { cnpjValido, formatarCNPJ, formatarTelefone, pct } from '@/lib/negocio'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Card } from '@/components/painel/comum'
import { Carregando, useToast } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { useMeuConsultor } from './dados'

type Regime = 'PF' | 'PJ1' | 'PJ2'

/** Dados do consultor: WhatsApp (o QR Code dos indicadores abre nele) e PF/PJ, que define o imposto de cada venda. */
export function MeusDados() {
  const p = usePerfil()
  const { refreshProfile } = useAuth()
  const me = useMeuConsultor()
  const config = useConfig()
  const qc = useQueryClient()
  const toast = useToast()
  const [tel, setTel] = useState(formatarTelefone(p.telefone ?? ''))
  const [cnpj, setCnpj] = useState(p.tipo_pessoa === 'PJ' ? formatarCNPJ(p.documento ?? '') : '')
  const atual: Regime = p.tipo_pessoa === 'PJ' ? (me.data?.faixa_pj === 2 ? 'PJ2' : 'PJ1') : 'PF'
  const [regime, setRegime] = useState<Regime | null>(null)
  const escolhido = regime ?? atual

  const salvarTel = useMutation({
    mutationFn: async () => {
      if (tel.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp com DDD.')
      const { error } = await supabase.from('profiles').update({ telefone: tel }).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      toast('WhatsApp salvo. O QR Code dos seus indicadores já abre nele.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const salvarRegime = useMutation({
    mutationFn: async () => {
      if (escolhido === 'PF') {
        const { error } = await supabase.from('profiles').update({ tipo_pessoa: 'PF' }).eq('id', p.id)
        if (error) throw error
        return
      }
      if (!cnpjValido(cnpj)) throw new Error('Informe um CNPJ válido.')
      const { error } = await supabase.from('profiles').update({ tipo_pessoa: 'PJ', documento: cnpj }).eq('id', p.id)
      if (error) throw error
      const r = await supabase.from('consultores').update({ faixa_pj: escolhido === 'PJ2' ? 2 : 1 }).eq('id', p.id)
      if (r.error) throw r.error
    },
    onSuccess: async () => {
      await refreshProfile()
      qc.invalidateQueries({ queryKey: ['con', 'me'] })
      setRegime(null)
      toast('Dados fiscais salvos. Valem para as vendas registradas daqui em diante.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (me.isLoading || config.isLoading) return <Carregando />
  const cfg = config.data
  const taxa = (v: number | null | undefined) => (v == null ? 'a definir' : pct(v))
  const opcoes: { v: Regime; titulo: string; imposto: string }[] = [
    { v: 'PF', titulo: 'Pessoa física', imposto: taxa(cfg?.aliquota_pf) },
    { v: 'PJ1', titulo: 'PJ · faixa 1', imposto: taxa(cfg?.aliquota_pj) },
    { v: 'PJ2', titulo: 'PJ · faixa 2', imposto: taxa(cfg?.aliquota_pj_2) },
  ]

  return (
    <>
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Meus dados</h1>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-[22px]">
          <span className="flex items-center gap-2 text-[16px] font-extrabold">
            <MessageCircle size={18} className="text-verde-600" />
            Seu WhatsApp
          </span>
          <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
            Quando um cliente escaneia o QR Code de um indicador seu, o WhatsApp abre direto neste número, com o código do indicador na mensagem.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              salvarTel.mutate()
            }}
          >
            <Field label="WhatsApp com DDD" value={tel} inputMode="tel" autoComplete="tel" onChange={(e) => setTel(formatarTelefone(e.target.value))} placeholder="(19) 99999-0000" />
            <Button type="submit" variant="primary" size="form" disabled={salvarTel.isPending}>
              {salvarTel.isPending && <Loader2 size={18} className="animate-spin" />}
              Salvar WhatsApp
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-3 p-[22px]">
          <span className="text-[16px] font-extrabold">Imposto das suas vendas</span>
          <p className="m-0 text-[13px] leading-[1.5] text-ink-600">
            O imposto é o seu: ele sai do valor da adesão (e da bonificação) antes da divisão com o indicador e com a Geralindica.
          </p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pessoa física ou jurídica">
            {opcoes.map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={escolhido === o.v}
                onClick={() => setRegime(o.v)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2.5 text-left',
                  escolhido === o.v ? 'border-verde-600 bg-verde-50' : 'border-ink-200 bg-white hover:border-ink-400',
                )}
              >
                <span className="text-[13px] font-extrabold">{o.titulo}</span>
                <span className="text-[12px] font-semibold text-ink-600">{o.imposto}</span>
              </button>
            ))}
          </div>
          {escolhido !== 'PF' && (
            <Field label="CNPJ" value={cnpj} inputMode="numeric" onChange={(e) => setCnpj(formatarCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
          )}
          <Button variant="dark" size="form" disabled={salvarRegime.isPending || (escolhido === atual && regime == null)} onClick={() => salvarRegime.mutate()}>
            {salvarRegime.isPending && <Loader2 size={18} className="animate-spin" />}
            Salvar
          </Button>
          <div className="flex items-start gap-2 rounded-[12px] bg-ink-50 px-3 py-2.5 text-[12px] leading-[1.5] text-ink-600">
            <Info size={16} className="mt-px shrink-0" />
            Mudar aqui vale para as próximas vendas que você registrar. As já registradas mantêm o imposto da época.
          </div>
        </Card>
      </div>
    </>
  )
}
