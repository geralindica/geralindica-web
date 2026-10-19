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
  const [f, setF] = useState({ pf: 27.5, pj: 6, ind: 50, con: 60, zap: '' })
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const [bruto, setBruto] = useState('1000')

  useEffect(() => {
    if (cfg.data)
      setF({
        pf: Number(cfg.data.aliquota_pf),
        pj: Number(cfg.data.aliquota_pj),
        ind: Number(cfg.data.pct_indicador),
        con: Number(cfg.data.pct_consultor_restante),
        zap: formatarTelefone(cfg.data.whatsapp_numero.replace(/^55/, '')),
      })
  }, [cfg.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const digitos = f.zap.replace(/\D/g, '')
      if (digitos.length < 10) throw new Error('Informe o WhatsApp da operação com DDD.')
      const { error } = await supabase
        .from('config_split')
        .update({ aliquota_pf: f.pf, aliquota_pj: f.pj, pct_indicador: f.ind, pct_consultor_restante: f.con, whatsapp_numero: `55${digitos}` })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] })
      toast('Configuração salva. Vale para as próximas adesões.')
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (cfg.isLoading) return <Carregando />
  if (cfg.error) return <ErroBox erro={cfg.error} onRetry={() => cfg.refetch()} />

  const r = calcularSplit(Number(bruto) || 0, tipo === 'PF' ? f.pf : f.pj, f.ind, f.con)

  return (
    <>
      <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Split e impostos</h1>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-3.5">
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Alíquotas</span>
            <Slider label="Pessoa física (IRRF)" valor={pct(f.pf)} min={0} max={35} step={0.5} v={f.pf} onChange={(v) => setF({ ...f, pf: v })} />
            <Slider label="Pessoa jurídica (Simples, padrão)" valor={pct(f.pj)} min={0} max={20} step={0.5} v={f.pj} onChange={(v) => setF({ ...f, pj: v })} />
          </Card>
          <Card className="flex flex-col gap-[18px] p-[22px]">
            <span className="text-[16px] font-extrabold">Divisão do líquido</span>
            <Slider label="Indicador" valor={`${f.ind}%`} min={30} max={70} step={5} v={f.ind} onChange={(v) => setF({ ...f, ind: v })} destaque />
            <Slider label="Do restante: consultor" valor={`${f.con}% · plataforma ${100 - f.con}%`} min={30} max={90} step={5} v={f.con} onChange={(v) => setF({ ...f, con: v })} />
            <div className="flex items-start gap-2.5 rounded-[12px] bg-ambar-bg px-3.5 py-3 text-[13px] font-semibold leading-[1.5] text-ambar-fg">
              <Gavel size={19} className="shrink-0" />
              Alterações valem só para novas adesões. Contratos Gov.br em vigor mantêm 50/50 até o aditivo ser assinado.
            </div>
          </Card>
          <Card className="flex flex-col gap-3 p-[22px]">
            <span className="flex items-center gap-2 text-[16px] font-extrabold">
              <MessageCircle size={18} className="text-verde-600" />
              WhatsApp da operação
            </span>
            <input
              value={f.zap}
              inputMode="tel"
              onChange={(e) => setF({ ...f, zap: formatarTelefone(e.target.value) })}
              placeholder="(19) 99999-0000"
              aria-label="Número do WhatsApp da operação"
              className="h-12 rounded-[12px] border border-ink-200 px-3.5 text-[15px] font-semibold outline-none focus:border-verde-500"
            />
            <p className="m-0 text-[12px] leading-[1.5] text-ink-600">Número que abre quando o cliente escaneia qualquer QR Code. Use o número conectado ao robô (ManyChat / API oficial).</p>
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
          <Linha k={`Imposto (${pct(tipo === 'PF' ? f.pf : f.pj)} ${tipo === 'PF' ? 'PF' : 'Simples'})`} v={`− ${brl(r.imposto)}`} vermelho />
          <div className="border-t border-dashed border-ink-200" />
          <div className="flex justify-between text-[15px]">
            <span className="font-bold">Valor líquido</span>
            <span className="font-extrabold">{brl(r.liquido)}</span>
          </div>
          <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
            <div className="bg-verde-600" style={{ flex: r.indicador || 1 }} />
            <div className="bg-ink-800" style={{ flex: r.consultor || 1 }} />
            <div className="bg-ink-400" style={{ flex: r.plataforma || 0.01 }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Caixa titulo={`Indicador ${f.ind}%`} v={brl(r.indicador)} verde />
            <Caixa titulo="Consultor" v={brl(r.consultor)} />
            <Caixa titulo="Plataforma" v={brl(r.plataforma)} />
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

function Slider({ label, valor, min, max, step, v, onChange, destaque }: { label: string; valor: string; min: number; max: number; step: number; v: number; onChange: (v: number) => void; destaque?: boolean }) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex justify-between text-[14px] font-bold">
        <span>{label}</span>
        <span className={destaque ? 'text-verde-700' : undefined}>{valor}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(+e.target.value)} className="w-full" />
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
