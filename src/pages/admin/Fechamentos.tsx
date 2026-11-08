import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, mensagemErro } from '@/lib/supabase'
import { Card, TituloPagina } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { brl, cn } from '@/lib/utils'
import { diaBR, mesBR } from '@/lib/negocio'
import type { Fechamento } from '@/lib/types'

export function useFechamentos(consultor?: string) {
  return useQuery({
    queryKey: ['fechamentos', consultor ?? 'todos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fechamentos', consultor ? { p_consultor: consultor } : {})
      if (error) throw error
      return ((data ?? []) as Fechamento[]).map((f) => ({ ...f, valor: Number(f.valor), juros: Number(f.juros), valor_pago: f.valor_pago == null ? null : Number(f.valor_pago), dias_atraso: Number(f.dias_atraso) }))
    },
  })
}

/** Situação de um mês: pago, a vencer, vence hoje ou atrasado (1% ao dia, cláusula 3.3 do consultor). */
export function situacao(f: Fechamento) {
  if (f.valor <= 0) return { label: f.valor < 0 ? 'Crédito do consultor' : 'Sem valor', cls: 'bg-ink-100 text-ink-600' }
  if (f.pago_em) return { label: `Pago em ${diaBR(f.pago_em)}`, cls: 'bg-verde-bg text-verde-fg' }
  if (f.dias_atraso > 0) return { label: `${f.dias_atraso} ${f.dias_atraso === 1 ? 'dia' : 'dias'} de atraso`, cls: 'bg-vermelho-bg text-vermelho-fg' }
  return { label: `Vence ${diaBR(f.vencimento)}`, cls: 'bg-ambar-bg text-ambar-fg' }
}

export function Fechamentos() {
  const q = useFechamentos()
  const qc = useQueryClient()
  const toast = useToast()
  const [soAbertos, setSoAbertos] = useState(true)
  const registrar = useMutation({
    mutationFn: async ({ f, pago }: { f: Fechamento; pago: boolean }) => {
      const hoje = new Date()
      const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
      let data: string | null = null
      if (pago) {
        data = window.prompt('Data em que o Pix chegou (AAAA-MM-DD)', iso)
        if (!data) return false
      }
      const { error } = await supabase.rpc('admin_registrar_fechamento', { p_consultor: f.consultor_id, p_mes: f.mes, p_pago_em: data, p_valor: pago ? f.valor + f.juros : null })
      if (error) throw error
      return true
    },
    onSuccess: (ok) => {
      if (ok) qc.invalidateQueries({ queryKey: ['fechamentos'] })
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })
  const lista = useMemo(() => (q.data ?? []).filter((f) => !soAbertos || (!f.pago_em && f.valor !== 0)), [q.data, soAbertos])
  const aberto = lista.filter((f) => !f.pago_em && f.valor > 0).reduce((a, f) => a + f.valor + f.juros, 0)

  return (
    <>
      <TituloPagina titulo="Fechamentos do mês">
        <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
          <input type="checkbox" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} />
          Só em aberto
        </label>
      </TituloPagina>
      <p className="m-0 text-[14px] leading-[1.55] text-ink-600">
        A parte da Geralindica de cada mês (vendas aprovadas, comissões recorrentes e trocas de plano, menos os estornos) vence no <b>dia 5 do mês seguinte</b>. Atraso: <b>1% ao dia</b> (cláusula 3.3 do consultor). Mês negativo é crédito do
        consultor: devolva em até 5 dias ou compense no mês seguinte (cláusulas 5.2 e 5.3).
      </p>
      <Card className="flex items-center justify-between p-4">
        <span className="text-[14px] font-semibold text-ink-600">Em aberto (com juros)</span>
        <span className="text-[22px] font-extrabold">{brl(aberto)}</span>
      </Card>
      {q.isLoading ? (
        <Carregando />
      ) : q.error ? (
        <ErroBox erro={q.error} onRetry={() => q.refetch()} />
      ) : !lista.length ? (
        <Vazio titulo="Nada em aberto" texto="Os meses aparecem aqui quando os consultores registram vendas aprovadas." />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_140px_120px_110px_170px_120px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-2.5 text-[12px] font-bold text-ink-600">
              <span>Consultor</span>
              <span>Mês</span>
              <span>Valor</span>
              <span>Juros</span>
              <span>Situação</span>
              <span />
            </div>
            {lista.map((f) => {
              const s = situacao(f)
              return (
                <div key={`${f.consultor_id}-${f.mes}`} className="grid grid-cols-[minmax(0,1.4fr)_140px_120px_110px_170px_120px] items-center gap-3 border-b border-ink-100 px-5 py-3 text-[14px] last:border-b-0">
                  <span className="truncate font-bold">{f.consultor}</span>
                  <span className="capitalize">{mesBR(f.mes)}</span>
                  <span className={cn('font-extrabold', f.valor < 0 && 'text-vermelho-fg')}>{brl(f.valor)}</span>
                  <span>{f.juros ? brl(f.juros) : '—'}</span>
                  <span className={cn('justify-self-start rounded-full px-2.5 py-0.5 text-[12px] font-bold', s.cls)}>{s.label}</span>
                  {f.valor > 0 &&
                    (f.pago_em ? (
                      <button type="button" onClick={() => registrar.mutate({ f, pago: false })} className="cursor-pointer text-[13px] font-bold text-ink-400 hover:text-vermelho-fg">
                        Desfazer
                      </button>
                    ) : (
                      <button type="button" disabled={registrar.isPending} onClick={() => registrar.mutate({ f, pago: true })} className="cursor-pointer rounded-full bg-verde-600 px-3 py-1 text-[13px] font-bold text-white">
                        Recebi
                      </button>
                    ))}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
