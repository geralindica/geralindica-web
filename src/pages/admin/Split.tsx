import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Loader2, MessageCircle } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useConfig } from '@/data/queries'
import { brl } from '@/lib/utils'
import { calcularSplit, formatarTelefone, pct } from '@/lib/negocio'
import { Button } from '@/components/ui/button'
import { Card, Segmentado } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'

type Regime = 'PF' | 'PJ1' | 'PJ2'

export function Split() {
  const cfg = useConfig()
  const qc = useQueryClient()
  const toast = useToast()
  // Campos em texto: vazio = "a definir" (gravado como null). Nenhum percentual fixo no código.
  const [f, setF] = useState({ pf: '', pj: '', pj2: '', ind: '', con: '', bon: '', zap: '' })
  const [regime, setRegime] = useState<Regime>('PF')
  const [valor, setValor] = useState('400')
  const [bonSim, setBonSim] = useState<string | null>(null)

  useEffect(() => {
    if (cfg.data)
      setF({
        pf: paraTexto(cfg.data.aliquota_pf),
        pj: paraTexto(cfg.data.aliquota_pj),
        pj2: paraTexto(cfg.data.aliquota_pj_2),
        ind: paraTexto(cfg.data.pct_indicador),
        con: paraTexto(cfg.data.pct_consultor_restante),
        bon: paraTexto(cfg.data.bonificacao_padrao),
        zap: formatarTelefone(cfg.data.whatsapp_numero.replace(/^55/, '')),
      })
  }, [cfg.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const digitos = f.zap.replace(/\D/g, '')
      if (digitos.length < 10) throw new Error('Informe o WhatsApp com DDD.')
      const ind = paraNumero(f.ind)
      if (ind == null) throw new Error('Informe o percentual do indicador.')
      for (const v of [f.pf, f.pj, f.pj2, f.ind, f.con]) {
        const n = paraNumero(v)
        if (n != null && (n < 0 || n > 100)) throw new Error('Os percentuais vão de 0 a 100.')
      }
      const bon = paraNumero(f.bon)
      if (bon != null && (bon < 0 || bon > 1000)) throw new Error('A bonificação vai de 0 a 1000%.')
      const { error } = await supabase
        .from('config_split')
        .update({
          aliquota_pf: paraNumero(f.pf),
          aliquota_pj: paraNumero(f.pj),
          aliquota_pj_2: paraNumero(f.pj2),
          pct_indicador: ind,
          pct_consultor_restante: paraNumero(f.con),
          bonificacao_padrao: bon,
          whatsapp_numero: `55${digitos}`,
        })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      toast('Configuração salva. Vale para as vendas registradas daqui em diante.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (cfg.isLoading) return <Carregando />
  if (cfg.error) return <ErroBox erro={cfg.error} onRetry={() => cfg.refetch()} />

  const aliq = paraNumero(regime === 'PF' ? f.pf : regime === 'PJ1' ? f.pj : f.pj2)
  const pctInd = paraNumero(f.ind) ?? 0
  const pctCon = paraNumero(f.con)
  const bon = paraNumero(bonSim ?? f.bon)
  const r = calcularSplit(Number(valor) || 0, aliq, pctInd, pctCon, bon)
  const rotuloRegime = { PF: 'PF', PJ1: 'PJ faixa 1', PJ2: 'PJ faixa 2' }[regime]

  return (
    <>
      <div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Split e configurações</h1>
        <p className="m-0 mt-1 max-w-[720px] text-[14px] leading-[1.5] text-ink-600">
          A Geralindica não movimenta dinheiro: estes percentuais só calculam quanto o consultor deve repassar por Pix ao indicador e à Geralindica. Mudanças valem para as vendas registradas daqui em diante.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Imposto do consultor</span>
            <CampoPct label="Consultor pessoa física" v={f.pf} onChange={(v) => setF({ ...f, pf: v })} />
            <CampoPct label="Consultor PJ · faixa 1" v={f.pj} onChange={(v) => setF({ ...f, pj: v })} />
            <CampoPct label="Consultor PJ · faixa 2" v={f.pj2} onChange={(v) => setF({ ...f, pj2: v })} />
            <p className="m-0 text-[12px] leading-[1.5] text-ink-600">O consultor PJ escolhe a faixa dele em Meus dados.</p>
          </Card>
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Divisão</span>
            <CampoPct label="Indicador (% do líquido da adesão)" v={f.ind} onChange={(v) => setF({ ...f, ind: v })} obrigatorio />
            <CampoPct label="Consultor (% do bolo; o resto é da Geralindica)" v={f.con} onChange={(v) => setF({ ...f, con: v })} />
            <CampoPct label="Bonificação sugerida (% da adesão)" v={f.bon} onChange={(v) => setF({ ...f, bon: v })} />
            <div className="flex items-start gap-2.5 rounded-[12px] bg-ink-50 px-3.5 py-3 text-[13px] font-semibold leading-[1.5] text-ink-600">
              <Info size={19} className="shrink-0" />
              Bolo = a parte do consultor na adesão + a bonificação que a operadora paga depois do Verdinho (já sem o imposto). O consultor informa a bonificação de cada venda ao registrá-la.
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-[22px]">
            <span className="flex items-center gap-2 text-[16px] font-extrabold">
              <MessageCircle size={18} className="text-verde-600" />
              WhatsApp geral
            </span>
            <input
              value={f.zap}
              inputMode="tel"
              onChange={(e) => setF({ ...f, zap: formatarTelefone(e.target.value) })}
              placeholder="(19) 99999-0000"
              aria-label="Número do WhatsApp geral"
              className="h-12 rounded-[12px] border border-ink-200 px-3.5 text-[15px] font-semibold outline-none focus:border-verde-500"
            />
            <p className="m-0 text-[12px] leading-[1.5] text-ink-600">O QR Code abre o WhatsApp do consultor do indicador. Este número só é usado quando o consultor ainda não cadastrou o dele.</p>
          </Card>
        </div>

        <Card className="sticky top-6 flex flex-col gap-3 rounded-[22px] p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[18px] font-extrabold">Simulador</span>
            <Segmentado
              valor={regime}
              onChange={setRegime}
              className="w-auto"
              opcoes={[
                { v: 'PF', label: 'PF' },
                { v: 'PJ1', label: 'PJ 1' },
                { v: 'PJ2', label: 'PJ 2' },
              ]}
            />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="flex h-[52px] items-center gap-2.5 rounded-[12px] border border-ink-200 px-3.5">
              <span className="text-[14px] font-bold text-ink-600">R$</span>
              <input
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-label="Valor da adesão"
                className="min-w-0 flex-1 bg-transparent text-[22px] font-extrabold outline-none"
              />
            </label>
            <label className="flex h-[52px] items-center gap-1.5 rounded-[12px] border border-ink-200 px-3">
              <input
                value={bonSim ?? f.bon}
                inputMode="decimal"
                onChange={(e) => setBonSim(e.target.value.replace(/[^\d,.]/g, ''))}
                aria-label="Bonificação da operadora (%)"
                className="min-w-0 flex-1 bg-transparent text-right text-[18px] font-extrabold outline-none"
              />
              <span className="text-[12px] font-bold text-ink-600">% bônus</span>
            </label>
          </div>
          <Linha k="Valor da adesão" v={brl(r.valor)} />
          <Linha k={aliq == null ? 'Imposto (a definir)' : `Imposto (${pct(aliq)} ${rotuloRegime})`} v={`− ${brl(r.imposto)}`} vermelho />
          <Linha k="Líquido" v={brl(r.liquido)} forte />
          <Linha k={`Indicador (${pct(pctInd)} do líquido)`} v={brl(r.indicador)} />
          <Linha k="Parte do consultor na adesão" v={brl(r.consultorAdesao)} />
          <div className="border-t border-dashed border-ink-200" />
          <Linha k={`Bonificação (${pct(bon ?? 0)}) − imposto`} v={`${brl(r.bonificacaoBruta)} → ${brl(r.bonificacao)}`} />
          <Linha k="Bolo (consultor + bonificação)" v={brl(r.bolo)} forte />
          <div className="grid grid-cols-3 gap-2">
            <Caixa titulo={`Indicador ${pct(pctInd)}`} v={brl(r.indicador)} verde />
            <Caixa titulo="Consultor" v={r.consultor == null ? 'a definir' : brl(r.consultor)} />
            <Caixa titulo="Geralindica" v={r.geralindica == null ? 'a definir' : brl(r.geralindica)} />
          </div>
          <Button variant="dark" size="md" className="font-extrabold" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 size={18} className="animate-spin" />}
            Salvar configuração
          </Button>
        </Card>
      </div>
    </>
  )
}

const paraTexto = (n: number | null) => (n == null ? '' : String(Number(n)).replace('.', ','))
const paraNumero = (t: string) => (t.trim() === '' ? null : Number(t.replace(',', '.')))

function CampoPct({ label, v, onChange, obrigatorio }: { label: string; v: string; onChange: (v: string) => void; obrigatorio?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 text-[14px] font-bold">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          value={v}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))}
          placeholder={obrigatorio ? '' : 'a definir'}
          className="h-10 w-[100px] rounded-[10px] border border-ink-200 px-3 text-right text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-ink-400 focus:border-verde-500"
        />
        %
      </span>
    </label>
  )
}

function Linha({ k, v, vermelho, forte }: { k: string; v: string; vermelho?: boolean; forte?: boolean }) {
  return (
    <div className={forte ? 'flex justify-between text-[15px]' : 'flex justify-between text-[14px]'}>
      <span className={forte ? 'font-bold' : 'text-ink-600'}>{k}</span>
      <span className={vermelho ? 'font-bold text-vermelho-fg' : forte ? 'font-extrabold' : 'font-bold'}>{v}</span>
    </div>
  )
}

function Caixa({ titulo, v, verde }: { titulo: string; v: string; verde?: boolean }) {
  return (
    <div className={verde ? 'rounded-[12px] bg-verde-50 p-3' : 'rounded-[12px] bg-ink-50 p-3'}>
      <div className={verde ? 'text-[11px] font-bold text-verde-700' : 'text-[11px] font-bold text-ink-600'}>{titulo}</div>
      <div className={verde ? 'text-[17px] font-extrabold text-verde-900' : 'text-[17px] font-extrabold'}>{v}</div>
    </div>
  )
}
