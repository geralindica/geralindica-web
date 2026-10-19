import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import type { Canal, ExtratoItem, Saque } from '@/lib/types'

export function useExtrato() {
  return useQuery({
    queryKey: ['ind', 'extrato'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('extrato_indicador')
      if (error) throw error
      return ((data ?? []) as ExtratoItem[]).map((e) => ({ ...e, bruto: Number(e.bruto), aliquota: Number(e.aliquota), comissao: Number(e.comissao) }))
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

export function useSaques() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['ind', 'saques'],
    queryFn: async () => {
      const { data, error } = await supabase.from('saques').select('*').eq('indicador_id', session!.user.id).order('created_at', { ascending: false }).limit(24)
      if (error) throw error
      return ((data ?? []) as Saque[]).map((s) => ({ ...s, valor: Number(s.valor) }))
    },
  })
}

export function totaisExtrato(itens: ExtratoItem[] | undefined) {
  const soma = (st: string) => (itens ?? []).filter((e) => e.status === st).reduce((a, e) => a + e.comissao, 0)
  return { liberado: soma('verdinho'), custodia: soma('custodia'), pago: soma('repassado'), pendente: soma('pendente') }
}

export const linkCanal = (codigo: string) => `${window.location.origin}/q/${codigo}`
export const rotuloCanal = (numero: number) => `CANAL ${String(numero).padStart(2, '0')}`
