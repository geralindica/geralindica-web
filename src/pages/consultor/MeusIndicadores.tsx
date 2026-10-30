import { useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import { usePerfil } from '@/auth/AuthProvider'
import { brl } from '@/lib/utils'
import { dataBR } from '@/lib/negocio'
import { Button } from '@/components/ui/button'
import { AtivoBadge } from '@/components/ui/badges'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio, useToast } from '@/components/ui/feedback'
import { useMeuConsultor, useMeusIndicadores } from './dados'

const NOVENTA_DIAS = 90 * 86400_000

export function MeusIndicadores() {
  const p = usePerfil()
  const toast = useToast()
  const me = useMeuConsultor()
  const ind = useMeusIndicadores()
  const [copiado, setCopiado] = useState(false)
  const convite = `${window.location.origin}/cadastro?papel=indicador&consultor=${p.id}`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(convite)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast('Não foi possível copiar o link.', 'erro')
    }
  }

  const c = me.data
  const vagas = c ? Math.max(0, c.max_indicadores - c.ocupacao) : 0
  const recentes = (i: { leads: number; consultor_desde: string | null }) => i.leads > 0 || (i.consultor_desde ? Date.now() - new Date(i.consultor_desde).getTime() < NOVENTA_DIAS : false)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[28px]">Meus indicadores</h1>
        {c && (
          <Card className="flex min-w-[min(100%,300px)] items-center gap-3.5 rounded-[14px] px-4 py-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex justify-between text-[13px] font-bold">
                <span>
                  {c.ocupacao}/{c.max_indicadores} indicadores
                </span>
                <span className={vagas ? 'text-verde-700' : 'text-ink-400'}>{vagas ? `${vagas} ${vagas === 1 ? 'vaga restante' : 'vagas restantes'}` : 'Carteira lotada'}</span>
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${c.max_indicadores}, 1fr)` }}>
                {Array.from({ length: c.max_indicadores }, (_, i) => (
                  <span key={i} className="h-2.5 rounded-sm" style={{ background: i < c.ocupacao ? '#0F9D58' : '#EAEFF5' }} />
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Link2 size={20} className="text-verde-700" />
        <div className="min-w-[200px] flex-1">
          <div className="text-[14px] font-bold">Link de convite para novos indicadores</div>
          <div className="truncate font-mono text-[12px] text-ink-600">{convite.replace(/^https?:\/\//, '')}</div>
        </div>
        <Button variant="dark" size="sm" onClick={copiar} disabled={!vagas}>
          {copiado ? <Check size={17} /> : <Link2 size={17} />}
          {copiado ? 'Copiado' : 'Copiar link'}
        </Button>
      </Card>

      {ind.isLoading ? (
        <Carregando />
      ) : ind.error ? (
        <ErroBox erro={ind.error} onRetry={() => ind.refetch()} />
      ) : !ind.data!.length ? (
        <Vazio titulo="Nenhum indicador ainda" texto="Compartilhe seu link de convite. Registrar as vendas e repassar os Pix em dia esquenta a sua temperatura e atrai indicadores." />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_70px_80px_140px_100px] gap-3 border-b border-ink-200 bg-ink-50 px-5 py-3 text-[12px] font-bold text-ink-600">
              <span>Indicador</span>
              <span>Canais</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Conversão</span>
              <span className="text-right" title="Estimativa da parte do indicador nas vendas aprovadas. Você faz o Pix por fora.">A repassar (Pix)</span>
              <span>Status</span>
            </div>
            {ind.data!.map((i) => (
              <div key={i.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_70px_80px_140px_100px] items-center gap-3 border-b border-ink-100 px-5 py-3.5 last:border-b-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-ink-100 text-[12px] font-extrabold">
                    {i.nome
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold">{i.nome}</div>
                    <div className="truncate text-[12px] text-ink-600">
                      {i.perfil ?? i.tipo_pessoa}
                      {i.consultor_desde && ` · desde ${dataBR(i.consultor_desde)}`}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {i.canais.map((c) => (
                    <span key={c} className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                      {c}
                    </span>
                  ))}
                </div>
                <span className="text-right text-[14px] font-bold">{i.leads}</span>
                <span className="text-right text-[14px] font-bold">{i.leads ? Math.round((i.aprovados * 100) / i.leads) : 0}%</span>
                <span className="text-right text-[14px] font-extrabold">{brl(i.a_repassar)}</span>
                <AtivoBadge ativo={recentes(i)} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
