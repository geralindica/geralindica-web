import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Gavel, Loader2, MessageCircle } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useConfig } from '@/data/queries'
import { brl } from '@/lib/utils'
import { calcularSplit, formatarTelefone, pct } from '@/lib/negocio'
import { Button } from '@/components/ui/button'
import { Card, Segmentado } from '@/components/painel/comum'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'

export function Split() {
  const cfg = useConfig()
  const qc = useQueryClient()
  const toast = useToast()
  // Campos em texto: vazio = "a definir" (gravado como null). Nenhum percentual fixo no código.
  const [f, setF] = useState({ pf: '', pj: '', ind: '', con: '', zap: '' })
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const [bruto, setBruto] = useState('1000')

  useEffect(() => {
    if (cfg.data)
      setF({
        pf: paraTexto(cfg.data.aliquota_pf),
        pj: paraTexto(cfg.data.aliquota_pj),
        ind: paraTexto(cfg.data.pct_indicador),
        con: paraTexto(cfg.data.pct_consultor_restante),
        zap: formatarTelefone(cfg.data.whatsapp_numero.replace(/^55/, '')),
      })
  }, [cfg.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const digitos = f.zap.replace(/\D/g, '')
      if (digitos.length < 10) throw new Error('Informe o WhatsApp com DDD.')
      const ind = paraNumero(f.ind)
      if (ind == null) throw new Error('Informe o percentual do indicador.')
      for (const v of [f.pf, f.pj, f.ind, f.con]) {
        const n = paraNumero(v)
        if (n != null && (n < 0 || n > 100)) throw new Error('Os percentuais vão de 0 a 100.')
      }
      const { error } = await supabase
        .from('config_split')
        .update({ aliquota_pf: paraNumero(f.pf), aliquota_pj: paraNumero(f.pj), pct_indicador: ind, pct_consultor_restante: paraNumero(f.con), whatsapp_numero: `55${digitos}` })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      toast('Configuração salva. As estimativas de todas as vendas já usam os novos valores.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (cfg.isLoading) return <Carregando />
  if (cfg.error) return <ErroBox erro={cfg.error} onRetry={() => cfg.refetch()} />

  const aliq = paraNumero(tipo === 'PF' ? f.pf : f.pj)
  const pctInd = paraNumero(f.ind) ?? 0
  const pctCon = paraNumero(f.con)
  const r = calcularSplit(Number(bruto) || 0, aliq, pctInd, pctCon)

  return (
    <>
      <div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Split e configurações</h1>
        <p className="m-0 mt-1 max-w-[720px] text-[14px] leading-[1.5] text-ink-600">
          A Geralindica não movimenta dinheiro: estes percentuais só calculam quanto o consultor deve repassar por Pix ao indicador e à Geralindica. Deixe em branco o que ainda não foi decidido.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Imposto (ainda em definição)</span>
            <CampoPct label="Indicador pessoa física" v={f.pf} onChange={(v) => setF({ ...f, pf: v })} />
            <CampoPct label="Indicador pessoa jurídica" v={f.pj} onChange={(v) => setF({ ...f, pj: v })} />
          </Card>
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Divisão do líquido</span>
            <CampoPct label="Indicador (% do líquido)" v={f.ind} onChange={(v) => setF({ ...f, ind: v })} obrigatorio />
            <CampoPct label="Do restante: consultor (o resto é da Geralindica)" v={f.con} onChange={(v) => setF({ ...f, con: v })} />
            <div className="flex items-start gap-2.5 rounded-[12px] bg-ambar-bg px-3.5 py-3 text-[13px] font-semibold leading-[1.5] text-ambar-fg">
              <Gavel size={19} className="shrink-0" />
              Decidido até agora: 50% do líquido para o indicador. Imposto e a divisão consultor x Geralindica ainda estão sendo calculados.
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
            <p className="m-0 text-[12px] leading-[1.5] text-ink-600">Número que abre quando o cliente escaneia um QR Code. Também é o contato da Geralindica mostrado ao indicador.</p>
          </Card>
        </div>

        <Card className="sticky top-6 flex flex-col gap-3.5 rounded-[22px] p-6 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[18px] font-extrabold">Simulador ao vivo</span>
            <Segmentado
              valor={tipo}
              onChange={setTipo}
              className="w-auto"
              opcoes={[
                { v: 'PF', label: 'PF' },
                { v: 'PJ', label: 'PJ' },
              ]}
            />
          </div>
          <label className="flex h-[52px] items-center gap-2.5 rounded-[12px] border border-ink-200 px-3.5">
            <span className="text-[14px] font-bold text-ink-600">R$</span>
            <input
              type="number"
              min={0}
              value={bruto}
              onChange={(e) => setBruto(e.target.value)}
              aria-label="Valor bruto da adesão"
              className="min-w-0 flex-1 bg-transparent text-[22px] font-extrabold outline-none"
            />
          </label>
          <Linha k="Valor bruto da adesão" v={brl(r.bruto)} />
          <Linha k={aliq == null ? 'Imposto (a definir)' : `Imposto (${pct(aliq)} ${tipo})`} v={`− ${brl(r.imposto)}`} vermelho />
          <div className="border-t border-dashed border-ink-200" />
          <div className="flex justify-between text-[15px]">
            <span className="font-bold">Valor líquido</span>
            <span className="font-extrabold">{brl(r.liquido)}</span>
          </div>
          <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
            <div className="bg-verde-600" style={{ flex: r.indicador || 1 }} />
            <div className="bg-ink-800" style={{ flex: (r.consultor ?? r.resto) || 1 }} />
            <div className="bg-ink-400" style={{ flex: r.plataforma || 0.01 }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Caixa titulo={`Indicador ${pctInd}%`} v={brl(r.indicador)} verde />
            <Caixa titulo="Consultor" v={r.consultor == null ? 'a definir' : brl(r.consultor)} />
            <Caixa titulo="Geralindica" v={r.plataforma == null ? 'a definir' : brl(r.plataforma)} />
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

const paraTexto = (n: number | null) => (n == null ? '' : String(n).replace('.', ','))
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

function Linha({ k, v, vermelho }: { k: string; v: string; vermelho?: boolean }) {
  return (
    <div className="flex justify-between text-[14px]">
      <span className="text-ink-600">{k}</span>
      <span className={vermelho ? 'font-bold text-vermelho-fg' : 'font-bold'}>{v}</span>
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
