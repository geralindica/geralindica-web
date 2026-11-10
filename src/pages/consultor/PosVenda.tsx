import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Repeat, Trash2, Wallet } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { brl } from '@/lib/utils'
import { STATUS_VENDA_OPCOES, diaBR, somarDiasUteis } from '@/lib/negocio'
import type { Recebimento, StatusVenda, Venda } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badges'
import { Card } from '@/components/painel/comum'
import { Field } from '@/components/ui/form'
import { useToast } from '@/components/ui/feedback'

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const numero = (t: string) => Number(t.replace(/\./g, '').replace(',', '.')) || 0

function useAcaoVenda<T>(fn: (v: T) => Promise<unknown>, ok: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['con'] })
      qc.invalidateQueries({ queryKey: ['fechamentos'] })
      toast(ok)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
}

/**
 * Depois do Verdinho (contratos do Luis): Pix do indicador em até 5 dias úteis, comissões recorrentes
 * (50% do líquido para a Geralindica) e troca de plano em até 10 anos.
 */
export function PosVenda({ venda, trocas, recebimentos }: { venda: Venda; trocas: Venda[]; recebimentos: Recebimento[] }) {
  const [novoRec, setNovoRec] = useState<{ valor: string; data: string; desc: string } | null>(null)
  const [novaTroca, setNovaTroca] = useState<{ valor: string; data: string; status: StatusVenda; bonif: string } | null>(null)

  const pagar = useAcaoVenda(async (pago: boolean) => {
    const { error } = await supabase.rpc('marcar_indicador_pago', { p_venda: venda.id, p_pago: pago })
    if (error) throw error
  }, 'Pagamento do indicador atualizado.')
  const addRec = useAcaoVenda(async () => {
    const { error } = await supabase.rpc('registrar_recebimento', { p_venda: venda.id, p_valor: numero(novoRec!.valor), p_data: novoRec!.data, p_descricao: novoRec!.desc || null })
    if (error) throw error
    setNovoRec(null)
  }, 'Recebimento registrado. Ele entra no fechamento do mês com a Geralindica.')
  const apagarRec = useAcaoVenda(async (id: string) => {
    const { error } = await supabase.rpc('apagar_recebimento', { p_id: id })
    if (error) throw error
  }, 'Recebimento apagado.')
  const addTroca = useAcaoVenda(async () => {
    const t = novaTroca!
    const { error } = await supabase.rpc('registrar_troca_plano', {
      p_venda_origem: venda.id,
      p_valor: numero(t.valor),
      p_data: t.data,
      p_status: t.status,
      p_bonificacao: t.bonif.trim() ? numero(t.bonif) : null,
    })
    if (error) throw error
    setNovaTroca(null)
  }, 'Troca de plano registrada. Ela gera de novo a parte do indicador e da Geralindica.')
  const statusTroca = useAcaoVenda(async ({ id, status }: { id: string; status: StatusVenda }) => {
    const { error } = await supabase.rpc('atualizar_troca_plano', { p_venda: id, p_status: status })
    if (error) throw error
  }, 'Troca de plano atualizada.')

  const aprovada = venda.status === 'aprovado'
  const prazoPix = venda.aprovado_em ? somarDiasUteis(venda.aprovado_em, 5) : null
  const fimTrocas = new Date(venda.data_venda + 'T12:00')
  fimTrocas.setFullYear(fimTrocas.getFullYear() + 10)

  return (
    <Card className="flex flex-col gap-4 p-[18px]">
      {venda.indicador_id && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[14px] font-extrabold">
            <Wallet size={16} />
            Pix ao indicador
          </span>
          {venda.indicador_pago_em ? (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-bold text-verde-700">Pago em {diaBR(venda.indicador_pago_em)}</span>
              <button type="button" onClick={() => pagar.mutate(false)} className="cursor-pointer font-bold text-ink-400 hover:text-vermelho-fg">
                Desfazer
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-ink-600">{prazoPix ? `Prazo: até ${prazoPix.toLocaleDateString('pt-BR')} (5 dias úteis depois de receber).` : ''}</span>
              <Button variant="primary" size="sm" className="h-9 px-3 text-[13px]" disabled={pagar.isPending} onClick={() => pagar.mutate(true)}>
                <Check size={15} />
                Já paguei
              </Button>
            </div>
          )}
        </div>
      )}

      {aprovada && (
        <div className="flex flex-col gap-2 border-t border-ink-100 pt-3">
          <span className="text-[14px] font-extrabold">Comissões recorrentes e bonificações seguintes</span>
          <span className="text-[12px] leading-[1.45] text-ink-600">Cada recebimento desse cliente depois da 1ª parcela: 50% do líquido é da Geralindica (cláusula 4.2 b). O indicador não entra.</span>
          {recebimentos.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[13px]">
              <span className="font-bold">{brl(r.valor)}</span>
              <span className="text-ink-600">{diaBR(r.recebido_em)}{r.descricao ? ` · ${r.descricao}` : ''}</span>
              <button type="button" aria-label="Apagar recebimento" onClick={() => apagarRec.mutate(r.id)} className="ml-auto cursor-pointer text-ink-400 hover:text-vermelho-fg">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {novoRec ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (numero(novoRec.valor) <= 0) return
                addRec.mutate(undefined)
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor recebido (R$)" inputMode="decimal" value={novoRec.valor} onChange={(e) => setNovoRec({ ...novoRec, valor: e.target.value.replace(/[^\d,.]/g, '') })} />
                <Field label="Data" type="date" max={hojeISO()} value={novoRec.data} onChange={(e) => setNovoRec({ ...novoRec, data: e.target.value })} />
              </div>
              <Field label="Descrição (opcional)" maxLength={120} value={novoRec.desc} placeholder="Ex.: comissão da 2ª parcela" onChange={(e) => setNovoRec({ ...novoRec, desc: e.target.value })} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-10 flex-1" onClick={() => setNovoRec(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" className="h-10 flex-1" disabled={addRec.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setNovoRec({ valor: '', data: hojeISO(), desc: '' })} className="flex cursor-pointer items-center gap-1.5 self-start text-[13px] font-bold text-verde-700">
              <Plus size={15} />
              Registrar recebimento
            </button>
          )}
        </div>
      )}

      {aprovada && (
        <div className="flex flex-col gap-2 border-t border-ink-100 pt-3">
          <span className="flex items-center gap-1.5 text-[14px] font-extrabold">
            <Repeat size={16} />
            Troca de plano
          </span>
          <span className="text-[12px] leading-[1.45] text-ink-600">
            Até {fimTrocas.toLocaleDateString('pt-BR')} (10 anos), se o cliente trocar de plano você paga de novo o indicador e a Geralindica (cláusula 3.5).
          </span>
          {trocas.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-bold">{brl(t.valor_adesao)}</span>
              <span className="text-ink-600">{diaBR(t.data_venda)}</span>
              <StatusBadge status={t.status} />
              {t.status === 'aguardando_entrevista' && (
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => statusTroca.mutate({ id: t.id, status: 'aprovado' })} className="cursor-pointer font-bold text-verde-700">
                    Aprovado
                  </button>
                  <button type="button" onClick={() => statusTroca.mutate({ id: t.id, status: 'reprovado' })} className="cursor-pointer font-bold text-vermelho-fg">
                    Reprovado
                  </button>
                </span>
              )}
            </div>
          ))}
          {novaTroca ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (numero(novaTroca.valor) <= 0) return
                addTroca.mutate(undefined)
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <Field label="Valor do plano novo (R$)" inputMode="decimal" value={novaTroca.valor} onChange={(e) => setNovaTroca({ ...novaTroca, valor: e.target.value.replace(/[^\d,.]/g, '') })} />
                <Field label="Data da troca" type="date" max={hojeISO()} value={novaTroca.data} onChange={(e) => setNovaTroca({ ...novaTroca, data: e.target.value })} />
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                Status
                <select value={novaTroca.status} onChange={(e) => setNovaTroca({ ...novaTroca, status: e.target.value as StatusVenda })} className="h-11 rounded-[12px] border border-ink-200 bg-white px-3 text-[14px] font-medium">
                  {STATUS_VENDA_OPCOES.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {novaTroca.status === 'aprovado' && (
                <Field label="Bonificação (% da adesão)" inputMode="decimal" value={novaTroca.bonif} placeholder="vazio = sugerida" onChange={(e) => setNovaTroca({ ...novaTroca, bonif: e.target.value.replace(/[^\d,.]/g, '') })} />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-10 flex-1" onClick={() => setNovaTroca(null)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="sm" className="h-10 flex-1" disabled={addTroca.isPending}>
                  Salvar troca
                </Button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setNovaTroca({ valor: '', data: hojeISO(), status: 'aguardando_entrevista', bonif: '' })} className="flex cursor-pointer items-center gap-1.5 self-start text-[13px] font-bold text-verde-700">
              <Plus size={15} />
              Cliente trocou de plano
            </button>
          )}
        </div>
      )}

    </Card>
  )
}
