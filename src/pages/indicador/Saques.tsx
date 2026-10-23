import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, Check, Loader2, Lock, Receipt, Zap } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth, usePerfil } from '@/auth/AuthProvider'
import { useConfig } from '@/data/queries'
import { sacarViaPix } from '@/integrations'
import { brl } from '@/lib/utils'
import { dataBR, pct } from '@/lib/negocio'
import type { TipoPessoa } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Card, Segmentado } from '@/components/painel/comum'
import { Carregando, Modal, Vazio, useToast } from '@/components/ui/feedback'
import { totaisExtrato, useExtrato, useSaques } from './dados'

export function Saques() {
  const p = usePerfil()
  const { refreshProfile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const extrato = useExtrato()
  const saques = useSaques()
  const config = useConfig()
  const [editPix, setEditPix] = useState(false)
  const [chave, setChave] = useState(p.chave_pix ?? '')
  const [ultimo, setUltimo] = useState<number | null>(null)
  const t = totaisExtrato(extrato.data)

  const sacar = useMutation({
    mutationFn: sacarViaPix,
    onSuccess: (s) => {
      setUltimo(Number(s.valor))
      qc.invalidateQueries({ queryKey: ['ind'] })
      toast(`Pix de ${brl(Number(s.valor))} enviado.`)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const salvarPerfil = useMutation({
    mutationFn: async (dados: { tipo_pessoa?: TipoPessoa; chave_pix?: string }) => {
      const { error } = await supabase.from('profiles').update(dados).eq('id', p.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refreshProfile()
      setEditPix(false)
      toast('Dados de recebimento atualizados.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const pj = p.tipo_pessoa === 'PJ'
  const chaveMascarada = p.chave_pix ? (p.chave_pix.length > 6 ? `${p.chave_pix.slice(0, 4)}•••••${p.chave_pix.slice(-3)}` : p.chave_pix) : 'Não cadastrada'

  return (
    <>
      <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.03em]">Saques e recebimento</h1>
      <div className="flex flex-col gap-3.5 rounded-[24px] bg-verde-600 p-[22px] text-white">
        <span className="text-[14px] font-bold text-verde-100">Disponível para saque</span>
        <span className="text-[40px] font-extrabold leading-none tracking-[-0.04em]">{extrato.isLoading ? '…' : brl(t.liberado)}</span>
        <button
          type="button"
          onClick={() => sacar.mutate()}
          disabled={sacar.isPending || t.liberado <= 0}
          className="flex h-[50px] cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-white text-[15px] font-extrabold text-verde-900 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sacar.isPending ? <Loader2 size={20} className="animate-spin" /> : ultimo && t.liberado <= 0 ? <Check size={20} /> : <Zap size={20} />}
          {ultimo && t.liberado <= 0 ? 'Pix enviado · cai em segundos' : t.liberado > 0 ? 'Sacar via Pix' : 'Nada liberado para saque'}
        </button>
        {t.custodia > 0 && <span className="text-[13px] font-semibold text-verde-100">+ {brl(t.custodia)} em custódia, liberados após a entrevista de saúde.</span>}
      </div>

      <Card className="flex flex-col gap-3 rounded-[20px] p-[18px]">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">Dados de recebimento</span>
          <button type="button" onClick={() => (setChave(p.chave_pix ?? ''), setEditPix(true))} className="cursor-pointer text-[13px] font-bold text-verde-700">
            Editar
          </button>
        </div>
        <Segmentado
          valor={p.tipo_pessoa}
          onChange={(v) => v !== p.tipo_pessoa && salvarPerfil.mutate({ tipo_pessoa: v })}
          opcoes={[
            { v: 'PF', label: 'Pessoa física' },
            { v: 'PJ', label: 'Pessoa jurídica' },
          ]}
        />
        <div className="flex items-center gap-2.5 rounded-[12px] border border-ink-200 bg-ink-50 px-3.5 py-3">
          <span className="flex size-[22px] items-center justify-center rounded-md bg-verde-700 font-mono text-[10px] font-bold text-white">PIX</span>
          <div className="flex flex-1 flex-col">
            <span className="text-[12px] text-ink-600">Chave Pix</span>
            <span className="font-mono text-[14px]">{chaveMascarada}</span>
          </div>
          <Lock size={18} className="text-ink-400" />
        </div>
        {config.data && (
          <div className="flex items-start gap-2.5 rounded-[12px] bg-ambar-bg px-3.5 py-3 text-[13px] font-semibold leading-[1.5] text-ambar-fg">
            <Receipt size={19} className="shrink-0" />
            {pj
              ? `PJ: o imposto segue a alíquota do Simples Nacional (${pct(config.data.aliquota_pj)} padrão). Emita nota fiscal para a Geralindica antes de cada saque.`
              : `PF: ${pct(config.data.aliquota_pf)} de imposto é retido sobre o valor bruto antes do split. O valor que você vê já é líquido, sem nota fiscal.`}
          </div>
        )}
        <p className="m-0 text-[12px] text-ink-400">A mudança PF/PJ vale para as próximas adesões; contratos já emitidos mantêm a alíquota original.</p>
      </Card>

      <div className="flex flex-col gap-2.5">
        <span className="text-[16px] font-extrabold">Histórico de saques</span>
        {saques.isLoading ? (
          <Carregando />
        ) : saques.data?.length ? (
          <Card className="overflow-hidden">
            {saques.data.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-ink-100 px-4 py-3.5 last:border-b-0">
                <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[12px] bg-verde-50 text-verde-700">
                  <ArrowDownLeft size={20} />
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-bold">Pix enviado</div>
                  <div className="text-[12px] text-ink-600">
                    {dataBR(s.created_at)} · {s.qtd} {s.qtd === 1 ? 'comissão' : 'comissões'}
                  </div>
                </div>
                <span className="text-[15px] font-extrabold">{brl(s.valor)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <Vazio titulo="Nenhum saque ainda" texto="Quando uma comissão virar Verdinho, é só tocar em Sacar via Pix." />
        )}
      </div>

      <Modal aberto={editPix} onFechar={() => setEditPix(false)} titulo="Chave Pix" sheetNoMobile={false}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (chave.trim().length < 5) return toast('Informe uma chave Pix válida (CPF, CNPJ, e-mail, telefone ou chave aleatória).', 'erro')
            salvarPerfil.mutate({ chave_pix: chave.trim() })
          }}
        >
          <Field label={pj ? 'Chave Pix da empresa' : 'Sua chave Pix'} value={chave} onChange={(e) => setChave(e.target.value)} autoFocus placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
          <p className="m-0 text-[12px] text-ink-600">A chave precisa estar no mesmo {pj ? 'CNPJ' : 'CPF'} do cadastro.</p>
          <Button type="submit" variant="primary" size="form" disabled={salvarPerfil.isPending}>
            Salvar chave
          </Button>
        </form>
      </Modal>
    </>
  )
}
