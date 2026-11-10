import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import type { Canal, StatusVenda, VendaIndicador } from '@/lib/types'

/** Vendas registradas pelos consultores com os códigos deste indicador (já filtradas pela LGPD no banco). */
export function useVendas() {
  return useQuery({
    queryKey: ['ind', 'vendas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vendas_indicador')
      if (error) throw error
      return ((data ?? []) as VendaIndicador[]).map((v) => ({ ...v, valor_adesao: Number(v.valor_adesao), estimativa: Number(v.estimativa) }))
    },
  })
}

export type Funil = { escaneamentos: number; conversas: number; cotacoes: number; fechados: number; aprovados: number; leads_andamento: number }

export function useFunil() {
  return useQuery({
    queryKey: ['ind', 'funil'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('funil_indicador')
      if (error) throw error
      const r = (data as Funil[] | null)?.[0]
      return {
        escaneamentos: Number(r?.escaneamentos ?? 0),
        conversas: Number(r?.conversas ?? 0),
        cotacoes: Number(r?.cotacoes ?? 0),
        fechados: Number(r?.fechados ?? 0),
        aprovados: Number(r?.aprovados ?? 0),
        leads_andamento: Number(r?.leads_andamento ?? 0),
      }
    },
  })
}

export type MesRelatorio = { mes: string; pendentes: number; em_atendimento: number; convertidas: number; canceladas: number }

export function useRelatorio() {
  return useQuery({
    queryKey: ['ind', 'relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('relatorio_indicador')
      if (error) throw error
      return ((data ?? []) as MesRelatorio[]).map((m) => ({
        mes: String(m.mes),
        pendentes: Number(m.pendentes),
        em_atendimento: Number(m.em_atendimento),
        convertidas: Number(m.convertidas),
        canceladas: Number(m.canceladas),
      }))
    },
  })
}

export function useCanais() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['ind', 'canais'],
    queryFn: async () => {
      const [canais, resumo] = await Promise.all([
        supabase.from('canais').select('*').eq('indicador_id', session!.user.id).order('numero'),
        supabase.rpc('canais_resumo'),
      ])
      if (canais.error) throw canais.error
      if (resumo.error) throw resumo.error
      const r = new Map(((resumo.data ?? []) as { canal_id: string; fechados: number; aprovados: number }[]).map((x) => [x.canal_id, x]))
      return ((canais.data ?? []) as Canal[]).map((c) => ({ ...c, fechados: Number(r.get(c.id)?.fechados ?? 0), aprovados: Number(r.get(c.id)?.aprovados ?? 0) }))
    },
  })
}

export function useMeuVinculo() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['ind', 'vinculo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('indicadores').select('consultor_id, consultor_desde, perfil').eq('id', session!.user.id).single()
      if (error) throw error
      return data as { consultor_id: string | null; consultor_desde: string | null; perfil: string | null }
    },
  })
}

/** Estimativas do que o consultor deve repassar (a plataforma não paga nada). */
export function totaisVendas(itens: VendaIndicador[] | undefined) {
  const soma = (st: StatusVenda) => (itens ?? []).filter((v) => v.status === st).reduce((a, v) => a + v.estimativa, 0)
  return { aprovado: soma('aprovado'), aguardando: soma('aguardando_entrevista') }
}

export const linkCanal = (codigo: string) => `${window.location.origin}/q/${codigo}`
export const rotuloCanal = (numero: number) => `CANAL ${String(numero).padStart(2, '0')}`
