import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { useAvaliacoes, useConsultores } from '@/data/queries'
import { useAuth } from '@/auth/AuthProvider'
import { dataBR } from '@/lib/negocio'
import { HotBadge, Pill, TemperaturaBadge, TopBadge } from '@/components/ui/badges'
import { Button, buttonVariants } from '@/components/ui/button'
import { VagasBar } from '@/components/VagasBar'
import { Avatar } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio } from '@/components/ui/feedback'

export function Perfil() {
  const { id } = useParams()
  const { profile } = useAuth()
  const consultores = useConsultores()
  const avaliacoes = useAvaliacoes(id)
  const c = consultores.data?.find((x) => x.id === id)

  if (consultores.isLoading) return <Carregando tela />
  if (consultores.error) return <main className="mx-auto w-full max-w-[1100px] px-7 py-12"><ErroBox erro={consultores.error} onRetry={() => consultores.refetch()} /></main>
  if (!c)
    return (
      <main className="mx-auto w-full max-w-[1100px] px-7 py-12">
        <Vazio titulo="Consultor não encontrado" texto="O perfil pode ter saído da vitrine.">
          <Link to="/consultores" className="mt-2 font-bold text-verde-700">
            Ver vitrine de consultores
          </Link>
        </Vazio>
      </main>
    )

  const stats = [
    { v: `${c.conv}%`, l: 'conversão' },
    { v: c.vendas, l: 'vendas' },
    { v: c.nota ? String(c.nota).replace('.', ',') : '–', l: 'avaliação' },
  ]
  const ehIndicadorLogado = profile?.papel === 'indicador'
  const longBio = `${c.bio ?? ''} Trabalho com as principais operadoras e acompanho cada cliente até a entrevista de saúde, e faço os Pix dos meus indicadores em dia.`.trim()

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-8 sm:px-7">
      <Link to="/consultores" className="inline-flex items-center gap-1.5 self-start text-[14px] font-bold text-ink-600 hover:text-ink-950">
        <ArrowLeft size={20} />
        Vitrine de consultores
      </Link>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-8 rounded-[28px] border border-ink-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-5">
            <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={104} rounded="xl" className="rounded-[28px]" />
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                <TemperaturaBadge valor={c.temperatura} />
                <Pill className="bg-ink-100 font-extrabold">#{c.rank} no ranking</Pill>
                {c.hot && <HotBadge />}
                {c.top && <TopBadge />}
              </div>
              <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.035em] sm:text-[34px]">{c.nome_exibicao}</h1>
              <div className="flex items-center gap-1 text-[14px] text-ink-600">
                <MapPin size={16} className="shrink-0" />
                {c.cidade}
                {c.susep && ` · SUSEP ${c.susep}`}
              </div>
            </div>
          </div>
          <p className="m-0 text-[16px] leading-[1.6] text-ink-800">{longBio}</p>
          <div className="flex flex-wrap gap-2">
            {c.especialidades.map((t) => (
              <span key={t} className="rounded-[10px] border border-ink-200 bg-ink-50 px-3 py-1.5 text-[13px] font-semibold">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[14px]">
          <div className="grid grid-cols-3 gap-[10px]">
            {stats.map((s) => (
              <div key={s.l} className="rounded-2xl bg-ink-50 p-4">
                <div className="text-[24px] font-extrabold tracking-[-0.03em] sm:text-[28px]">{s.v}</div>
                <div className="text-[13px] text-ink-600">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-[10px] rounded-2xl border border-ink-200 p-[18px]">
            <div className="flex justify-between text-[14px] font-bold">
              <span>Vagas na carteira</span>
              <span>
                {c.ocupacao}/{c.max_indicadores} indicadores
              </span>
            </div>
            <VagasBar c={c} size="lg" />
            <div className="text-[13px] font-bold" style={{ color: c.barColor }}>
              {c.vagaLabel}
            </div>
          </div>
          {c.full ? (
            <>
              <Button variant="muted" size="xl" disabled>
                Carteira lotada
              </Button>
              <p className="m-0 text-center text-[13px] text-ink-600">Carteira lotada. Ative "Só com vaga" na vitrine para ver opções disponíveis.</p>
            </>
          ) : ehIndicadorLogado ? (
            <Link to="/indicador/consultor" className={buttonVariants({ variant: 'primary', size: 'xl' })}>
              Trocar para {c.primeiroNome}
            </Link>
          ) : (
            <Link to={`/cadastro?papel=indicador&consultor=${c.id}`} className={buttonVariants({ variant: 'primary', size: 'xl' })}>
              Quero ser indicador {c.primeiroNome.endsWith('a') ? 'dela' : 'dele'}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[14px]">
        <h2 className="m-0 text-[22px] font-extrabold tracking-[-0.02em]">Avaliações de indicadores</h2>
        {avaliacoes.data?.length ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
            {avaliacoes.data.map((r) => (
              <div key={r.id} className="flex flex-col gap-[10px] rounded-[18px] border border-ink-200 bg-white p-5">
                <div className="text-[15px] tracking-[2px] text-ambar-solid" aria-label={`${r.estrelas} de 5 estrelas`}>
                  {'★'.repeat(r.estrelas) + '☆'.repeat(5 - r.estrelas)}
                </div>
                <p className="m-0 text-[15px] leading-[1.55]">{r.texto}</p>
                <div className="text-[13px] font-semibold text-ink-600">
                  {r.autor} · {dataBR(r.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[14px] text-ink-600">{avaliacoes.isLoading ? 'Carregando…' : 'Ainda sem avaliações.'}</p>
        )}
      </div>
    </main>
  )
}
