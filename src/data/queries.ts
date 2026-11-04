import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { enriquecerConsultores } from '@/lib/negocio'
import type { Avaliacao, ConfigSplit, ConsultorRow, Produto } from '@/lib/types'

/** Vitrine pública: consultores publicados já ordenados por ranking. */
export function useConsultores() {
  return useQuery({
    queryKey: ['consultores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultores').select('*').eq('publicado', true)
      if (error) throw error
      return enriquecerConsultores((data ?? []) as ConsultorRow[])
    },
    staleTime: 60_000,
  })
}

export function useAvaliacoes(consultorId: string | undefined) {
  return useQuery({
    queryKey: ['avaliacoes', consultorId],
    enabled: !!consultorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('consultor_id', consultorId!)
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data ?? []) as Avaliacao[]
    },
  })
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('config_split').select('*').eq('id', 1).single()
      if (error) throw error
      // numeric chega como texto ("27.50"); vazio continua null (= a definir)
      const n = (v: unknown) => (v == null ? null : Number(v))
      const c = data as ConfigSplit
      return {
        ...c,
        aliquota_pf: n(c.aliquota_pf),
        aliquota_pj: n(c.aliquota_pj),
        aliquota_pj_2: n(c.aliquota_pj_2),
        pct_indicador: Number(c.pct_indicador),
        pct_consultor_restante: n(c.pct_consultor_restante),
        bonificacao_padrao: n(c.bonificacao_padrao),
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useProdutos() {
  return useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('*').order('ordem')
      if (error) throw error
      return (data ?? []) as Produto[]
    },
  })
}
