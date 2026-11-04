import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, GitBranch, Handshake, Hourglass, KanbanSquare, Link2Off, Percent, Thermometer, Users } from 'lucide-react'
import { usePerfil } from '@/auth/AuthProvider'
import { useConsultores } from '@/data/queries'
import { brl } from '@/lib/utils'
import { nomeEtapa, primeiroNome, tempoDesde, ETAPAS_FINAIS } from '@/lib/negocio'
import { CheckCircleFilled } from '@/components/icons'
import { TemperaturaBadge } from '@/components/ui/badges'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/painel/comum'
import { Carregando, ErroBox } from '@/components/ui/feedback'
import { useDashboard, useLeadsCRM, useMeuConsultor } from './dados'

const DIA = 86400_000

export function Dashboard() {
  const p = usePerfil()
  const nav = useNavigate()
  const me = useMeuConsultor()
  const dash = useDashboard()
  const leads = useLeadsCRM()
  const ranking = useConsultores()

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const eu = ranking.data?.find((c) => c.id === p.id)
  const media = ranking.data?.length
    ? Math.round((ranking.data.reduce((a, c) => a + c.vendas, 0) * 100) / Math.max(1, ranking.data.reduce((a, c) => a + c.leads_total, 0)))
    : 0

  const ativos = (leads.data ?? []).filter((l) => !ETAPAS_FINAIS.includes(l.etapa))
  const agora = Date.now()
  const atencao = [
    ...ativos.filter((l) => !l.canal_id).map((l) => ({ l, icon: Link2Off, tom: 'ambar', texto: 'Sem código do indicador. Confirme a atribuição.' })),
    ...ativos
      .filter((l) => l.etapa === 'custodia' && agora - new Date(l.updated_at).getTime() > 3 * DIA)
      .map((l) => ({ l, icon: Hourglass, tom: 'ambar', texto: `Pagamento recebido há ${tempoDesde(l.updated_at)}. Agendar entrevista com a Administradora.` })),
    ...ativos
      .filter((l) => l.etapa === 'entrevista' && agora - new Date(l.updated_at).getTime() > 7 * DIA)
      .map((l) => ({ l, icon: Hourglass, tom: 'ambar', texto: `Em entrevista há ${tempoDesde(l.updated_at)}. Registre o resultado da venda.` })),
    ...ativos
      .filter((l) => l.etapa === 'negociacao' && agora - new Date(l.updated_at).getTime() > 2 * DIA)
      .map((l) => ({ l, icon: Clock, tom: 'azul', texto: `Em negociação há ${tempoDesde(l.updated_at)} sem resposta.` })),
  ].slice(0, 6)

  if (me.error || dash.error) return <ErroBox erro={me.error || dash.error} onRetry={() => (me.refetch(), dash.refetch())} />
  if (me.isLoading || dash.isLoading) return <Carregando />
  const c = me.data!
  const d = dash.data!
  const variacao = d.vendasMesAnt ? Math.round(((d.vendasMes - d.vendasMesAnt) / d.vendasMesAnt) * 100) : null
  const maxDia = Math.max(1, ...d.porDia.map((x) => x.n))
  const totalDias = d.porDia.reduce((a, x) => a + x.n, 0)
  const conv = c.leads_total ? Math.round((c.vendas * 100) / c.leads_total) : 0

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[14px] font-semibold text-ink-600 first-letter:uppercase">{hoje}</div>
          <h1 className="m-0 mt-1 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">
            {saudacao}, {primeiroNome(p.nome)}
          </h1>
        </div>
        <Link to="/consultor/leads" className={buttonVariants({ variant: 'dark', size: 'md', className: 'h-11 text-[14px]' })}>
          <KanbanSquare size={20} />
          Abrir CRM de leads
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Kpi icon={<Handshake size={19} className="text-verde-600" />} rotulo="Vendas no mês" valor={String(d.vendasMes)}>
          {variacao !== null && (
            <span className={variacao >= 0 ? 'text-verde-700' : 'text-vermelho-fg'}>
              {variacao >= 0 ? '+' : ''}
              {variacao}% vs. mesmo período do mês passado
            </span>
          )}
        </Kpi>
        <Kpi icon={<Percent size={19} className="text-azul-solid" />} rotulo="Taxa de conversão" valor={`${conv}%`}>
          <span className="text-ink-600">média da plataforma: {media}%</span>
        </Kpi>
        <Kpi icon={<Thermometer size={19} className="text-laranja-fg" />} rotulo="Sua temperatura" valor={`${c.temperatura}°`} extra={<TemperaturaBadge valor={c.temperatura} />}>
          <span className="text-ink-600">
            {eu ? `#${eu.rank} no ranking · ` : ''}
            {c.vendas} vendas aprovadas registradas
          </span>
        </Kpi>
        <Kpi icon={<Users size={19} />} rotulo="Vagas ocupadas" valor={String(c.ocupacao)} sufixo={`/${c.max_indicadores}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full bg-verde-600" style={{ width: `${Math.round((c.ocupacao / c.max_indicadores) * 100)}%` }} />
          </div>
        </Kpi>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="flex flex-col gap-[18px] p-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[16px] font-extrabold">Leads por dia</span>
            <span className="text-[13px] font-semibold text-ink-600">Últimos 30 dias · {totalDias} leads</span>
          </div>
          <div className="flex h-[200px] items-end gap-[3px] border-b border-ink-100 sm:gap-[5px]">
            {d.porDia.map((x, i) => (
              <div
                key={x.dia}
                title={`${new Date(x.dia + 'T12:00').toLocaleDateString('pt-BR')}: ${x.n} leads`}
                className="flex-1 rounded-[5px_5px_2px_2px]"
                style={{ height: `${Math.max(2, (x.n / maxDia) * 100)}%`, background: i >= 23 ? '#0F9D58' : '#A6E1C2' }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[12px] font-semibold text-ink-400">
            {[0, 14, 29].map((i) => (
              <span key={i}>{new Date(d.porDia[i].dia + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-verde-600 p-5 text-white">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-verde-100">
              <CheckCircleFilled size={18} />
              Vendas aprovadas (Verdinho)
            </span>
            <span className="text-[30px] font-extrabold tracking-[-0.03em]">{brl(d.aprovado)}</span>
            <span className="text-[12px] font-semibold text-verde-100">
              {d.aprovadoQtd} {d.aprovadoQtd === 1 ? 'adesão aprovada' : 'adesões aprovadas'} neste mês
            </span>
            <div className="mt-1 flex flex-col gap-1 rounded-[12px] bg-verde-700/40 px-3 py-2.5 text-[13px] font-semibold">
              <div className="flex justify-between">
                <span className="text-verde-100">Pix aos indicadores</span>
                <span className="font-extrabold">{brl(d.pixIndicadores)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-verde-100">Pix à Geralindica (com a bonificação)</span>
                <span className="font-extrabold">{d.pixGeralindica == null ? 'a definir' : brl(d.pixGeralindica)}</span>
              </div>
            </div>
          </div>
          <Card className="flex flex-col gap-1.5 p-5">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-ambar-fg">
              <Hourglass size={17} strokeWidth={2.6} />
              Com você até a entrevista
            </span>
            <span className="text-[30px] font-extrabold tracking-[-0.03em]">{brl(d.aguardando)}</span>
            <span className="text-[12px] font-semibold text-ink-600">{d.aguardandoQtd} aguardando entrevista de saúde · devolva ao cliente se reprovar</span>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-[22px] py-[18px]">
          <span className="text-[16px] font-extrabold">Precisam da sua atenção</span>
          <Link to="/consultor/leads" className="text-[13px] font-bold text-verde-700">
            Ver todos
          </Link>
        </div>
        {leads.isLoading ? (
          <Carregando />
        ) : atencao.length ? (
          atencao.map(({ l, icon: Icon, tom, texto }) => (
            <button
              key={l.id + texto}
              type="button"
              onClick={() => nav(`/consultor/leads/${l.id}`)}
              className="flex w-full cursor-pointer items-center gap-3.5 border-b border-ink-100 px-[22px] py-3.5 text-left last:border-b-0 hover:bg-[#F9FAFC]"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${tom === 'azul' ? 'bg-azul-bg text-azul-fg' : 'bg-ambar-bg text-ambar-fg'}`}>
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{l.nome}</div>
                <div className="text-[12px] text-ink-600">{texto}</div>
              </div>
              <span className="hidden rounded-lg bg-ink-50 px-2.5 py-1 text-[12px] font-bold text-ink-600 sm:inline">{nomeEtapa(l.etapa)}</span>
              <ChevronRight size={20} className="text-ink-400" />
            </button>
          ))
        ) : (
          <div className="flex items-center gap-2 px-[22px] py-5 text-[14px] font-semibold text-ink-600">
            <GitBranch size={18} /> Tudo em dia. Nenhum lead parado.
          </div>
        )}
      </Card>
    </>
  )
}

function Kpi({ icon, rotulo, valor, sufixo, extra, children }: { icon: ReactNode; rotulo: string; valor: string; sufixo?: string; extra?: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
        {icon}
        {rotulo}
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[36px] font-extrabold tracking-[-0.035em]">
          {valor}
          {sufixo && <span className="text-[20px] text-ink-400">{sufixo}</span>}
        </span>
        {extra}
      </div>
      <div className="text-[12px] font-bold">{children}</div>
    </Card>
  )
}
