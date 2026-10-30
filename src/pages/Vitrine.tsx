import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, MapPin } from 'lucide-react'
import { useConsultores } from '@/data/queries'
import { Chip, Eyebrow } from '@/components/ui/form'
import { HotBadge, TemperaturaBadge, TopBadge } from '@/components/ui/badges'
import { VagasBar } from '@/components/VagasBar'
import { Avatar } from '@/components/painel/comum'
import { Carregando, ErroBox, Vazio } from '@/components/ui/feedback'

const TODAS = 'Todas as cidades'
const convOpts: [number, string][] = [
  [0, 'Todas'],
  [30, '30%+'],
  [35, '35%+'],
]

function mesAtual() {
  const d = new Date()
  return `${d.toLocaleDateString('pt-BR', { month: 'long' })}/${d.getFullYear()}`
}

export function Vitrine() {
  const consultores = useConsultores()
  const [city, setCity] = useState(TODAS)
  const [minConv, setMinConv] = useState(0)
  const [soVaga, setSoVaga] = useState(false)

  const cidades = useMemo(() => [TODAS, ...Array.from(new Set((consultores.data ?? []).map((c) => c.cidade).filter(Boolean) as string[])).sort()], [consultores.data])
  const list = useMemo(
    () => (consultores.data ?? []).filter((c) => (city === TODAS || c.cidade === city) && c.conv >= minConv && (!soVaga || !c.full)),
    [consultores.data, city, minConv, soVaga],
  )

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pb-24 pt-12 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-[10px]">
          <Eyebrow>Ranking público · {mesAtual()}</Eyebrow>
          <h1 className="m-0 text-[36px] font-extrabold tracking-[-0.04em] sm:text-[44px]">Escolha seu consultor</h1>
          <p className="m-0 text-[16px] text-ink-600">Ordenado pela temperatura: quem registra as vendas e paga os indicadores em dia fica no topo.</p>
        </div>
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-600">
          <ArrowUpDown size={18} />
          Ordenar: <b className="text-ink-950">Ranking</b>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[10px] rounded-[18px] border border-ink-200 bg-white p-3">
        <div className="flex h-[42px] min-w-[200px] flex-1 items-center gap-2 rounded-[12px] bg-ink-50 px-3 sm:flex-none">
          <MapPin size={20} className="text-ink-600" />
          <select aria-label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} className="flex-1 cursor-pointer border-0 bg-transparent text-[14px] font-semibold outline-none">
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <span className="pl-2 pr-1 text-[13px] font-bold text-ink-600">Conversão</span>
        {convOpts.map(([v, l]) => (
          <Chip key={v} active={minConv === v} onClick={() => setMinConv(v)} className="inline-flex h-[38px] items-center rounded-full px-[14px] text-[13px]">
            {l}
          </Chip>
        ))}
        <button
          type="button"
          role="switch"
          aria-checked={soVaga}
          onClick={() => setSoVaga(!soVaga)}
          className="ml-auto inline-flex cursor-pointer items-center gap-[10px] bg-transparent px-2 text-[14px] font-bold text-ink-950"
        >
          <span className={`relative h-6 w-10 rounded-full transition-colors ${soVaga ? 'bg-verde-600' : 'bg-ink-200'}`}>
            <span className={`absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] ${soVaga ? 'left-[19px]' : 'left-[3px]'}`} />
          </span>
          Só com vaga
        </button>
      </div>

      {consultores.isLoading ? (
        <Carregando />
      ) : consultores.error ? (
        <ErroBox erro={consultores.error} onRetry={() => consultores.refetch()} />
      ) : (
        <>
          <div className="text-[14px] font-semibold text-ink-600" aria-live="polite">
            {list.length} {list.length === 1 ? 'consultor encontrado' : 'consultores encontrados'}
          </div>
          {!list.length && <Vazio titulo="Ninguém com esses filtros" texto="Tente outra cidade ou desligue o filtro de conversão." />}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[18px]">
            {list.map((c) => (
              <Link
                key={c.id}
                to={`/consultores/${c.id}`}
                className="flex flex-col gap-[14px] rounded-[20px] border border-ink-200 bg-white p-5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-center gap-[14px]">
                  <div className="relative">
                    <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={56} />
                    <span className="absolute -bottom-1 -right-1.5 flex h-[22px] min-w-6 items-center justify-center rounded-full border-2 border-white bg-ink-950 px-1.5 text-[11px] font-extrabold text-white">
                      #{c.rank}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-extrabold">{c.nome_exibicao}</div>
                    <div className="flex items-center gap-1 text-[13px] text-ink-600">
                      <MapPin size={14} />
                      {c.cidade}
                    </div>
                  </div>
                </div>
                <div className="flex min-h-[22px] flex-wrap gap-1.5">
                  <TemperaturaBadge valor={c.temperatura} />
                  {c.hot && <HotBadge />}
                  {c.top && <TopBadge />}
                </div>
                <p className="m-0 min-h-[42px] text-[14px] leading-[1.5] text-ink-600">{c.bio}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] bg-ink-50 px-3 py-[10px]">
                    <div className="text-[20px] font-extrabold">{c.conv}%</div>
                    <div className="text-[12px] text-ink-600">conversão</div>
                  </div>
                  <div className="rounded-[12px] bg-ink-50 px-3 py-[10px]">
                    <div className="text-[20px] font-extrabold">{c.vendas}</div>
                    <div className="text-[12px] text-ink-600">vendas</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[12px] font-semibold">
                    <span className="text-ink-600">Vagas</span>
                    <span>
                      {c.ocupacao}/{c.max_indicadores} indicadores
                      <span style={{ color: c.barColor }}> · {c.vagaLabel}</span>
                    </span>
                  </div>
                  <VagasBar c={c} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
