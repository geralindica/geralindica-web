import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Apple, Flower2, ShieldPlus, Smile, Store, type LucideIcon } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useProdutos } from '@/data/queries'
import { cn } from '@/lib/utils'
import type { Produto } from '@/lib/types'
import { Carregando, ErroBox, useToast } from '@/components/ui/feedback'

const ICONES: Record<string, LucideIcon> = { health: ShieldPlus, odonto: Smile, estetica: Flower2, suplementos: Apple, convenios: Store }

export function Catalogo() {
  const produtos = useProdutos()
  const qc = useQueryClient()
  const toast = useToast()
  const cont = useQuery({
    queryKey: ['adm', 'contagens'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_contagens')
      if (error) throw error
      const r = (data as { consultores: number; indicadores: number; adesoes: number }[])[0]
      return { consultores: Number(r.consultores), indicadores: Number(r.indicadores), adesoes: Number(r.adesoes) }
    },
  })
  const espera = useMutation({
    mutationFn: async (p: Produto) => {
      const { error } = await supabase.from('produtos').update({ lista_espera: !p.lista_espera }).eq('id', p.id)
      if (error) throw error
      return p
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['produtos'] })
      toast(p.lista_espera ? `Lista de espera de ${p.nome} fechada.` : `Lista de espera de ${p.nome} aberta.`)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  if (produtos.isLoading) return <Carregando />
  if (produtos.error) return <ErroBox erro={produtos.error} onRetry={() => produtos.refetch()} />
  const ativos = produtos.data!.filter((p) => p.status === 'ativo')
  const breve = produtos.data!.filter((p) => p.status !== 'ativo')

  return (
    <>
      <div>
        <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]">Catálogo de produtos</h1>
        <div className="mt-1 text-[14px] text-ink-600">Produtos que os indicadores podem divulgar. Por enquanto, só Plano de Saúde está ativo.</div>
      </div>
      {ativos.map((p) => {
        const Icon = ICONES[p.icone] ?? ShieldPlus
        return (
          <div key={p.id} className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-center gap-6 rounded-[22px] border-2 border-verde-600 bg-white p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-verde-50 text-verde-700">
                <Icon size={30} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[20px] font-extrabold">{p.nome}</span>
                  <span className="rounded-full bg-verde-600 px-[9px] py-0.5 text-[11px] font-extrabold text-white">ATIVO</span>
                </div>
                <div className="text-[13px] text-ink-600">{p.descricao}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                [cont.data?.adesoes, 'adesões'],
                [cont.data?.consultores, 'consultores'],
                [cont.data?.indicadores, 'indicadores'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-[12px] bg-ink-50 px-3 py-2.5">
                  <div className="text-[18px] font-extrabold">{v === undefined ? '…' : Number(v).toLocaleString('pt-BR')}</div>
                  <div className="text-[12px] text-ink-600">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
        {breve.map((p) => {
          const Icon = ICONES[p.icone] ?? Store
          return (
            <div key={p.id} className="flex flex-col gap-3.5 rounded-[20px] border border-dashed border-[#C9D1CD] bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-[14px] bg-ink-100 text-ink-600">
                  <Icon size={24} />
                </span>
                <span className="rounded-full bg-ink-100 px-[9px] py-[3px] text-[11px] font-extrabold text-ink-600">EM BREVE</span>
              </div>
              <div>
                <div className="text-[17px] font-extrabold">{p.nome}</div>
                <div className="mt-1 text-[13px] leading-[1.5] text-ink-600">{p.descricao}</div>
              </div>
              <div className="text-[12px] font-semibold text-ink-600">Previsão: {p.previsao ?? 'a definir'}</div>
              <button
                type="button"
                disabled={espera.isPending}
                onClick={() => espera.mutate(p)}
                className={cn('h-[38px] cursor-pointer rounded-[10px] border border-ink-200 text-[13px] font-bold', p.lista_espera ? 'bg-verde-50 text-verde-700' : 'bg-white text-ink-950')}
              >
                {p.lista_espera ? 'Lista de espera ativa ✓' : 'Abrir lista de espera'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
