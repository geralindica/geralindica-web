import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { ETAPAS_FINAIS } from '@/lib/negocio'
import type { ConsultorRow, LeadComOrigem, LeadEvento, Venda } from '@/lib/types'

/** Data no fuso do navegador, no formato AAAA-MM-DD. */
const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const SELECT_LEAD = '*, canal:canais(codigo, numero, nome), ind:indicadores(perfil, p:profiles(nome))'

type LeadBruto = Omit<LeadComOrigem, 'indicador'> & { ind: { perfil: string | null; p: { nome: string } | null } | null }

function normalizar(l: LeadBruto): LeadComOrigem {
  const { ind, ...resto } = l
  return { ...resto, valor_adesao: resto.valor_adesao == null ? null : Number(resto.valor_adesao), indicador: ind?.p ? { nome: ind.p.nome } : null }
}

export function useMeuConsultor() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['con', 'me'],
    queryFn: async () => {
      const { data, error } = await supabase.from('consultores').select('*').eq('id', session!.user.id).single()
      if (error) throw error
      return data as ConsultorRow
    },
  })
}

/** Leads ativos + concluídos nos últimos 30 dias (o que aparece no CRM). */
export function useLeadsCRM() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['con', 'leads'],
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86400_000).toISOString()
      const { data, error } = await supabase
        .from('leads')
        .select(SELECT_LEAD)
        .eq('consultor_id', session!.user.id)
        .or(`etapa.not.in.(${ETAPAS_FINAIS.join(',')}),updated_at.gte.${desde}`)
        .order('updated_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return ((data ?? []) as LeadBruto[]).map(normalizar)
    },
    refetchInterval: 60_000,
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['con', 'lead', id],
    enabled: !!id,
    queryFn: async () => {
      const [lead, eventos, venda] = await Promise.all([
        supabase.from('leads').select(SELECT_LEAD).eq('id', id!).maybeSingle(),
        supabase.from('lead_eventos').select('*').eq('lead_id', id!).order('created_at'),
        supabase.from('vendas').select('*').eq('lead_id', id!).maybeSingle(),
      ])
      if (lead.error) throw lead.error
      if (eventos.error) throw eventos.error
      if (venda.error) throw venda.error
      const v = venda.data as Venda | null
      return {
        lead: lead.data ? normalizar(lead.data as LeadBruto) : null,
        eventos: (eventos.data ?? []) as LeadEvento[],
        venda: v ? { ...v, valor_adesao: Number(v.valor_adesao) } : null,
      }
    },
  })
}

export function useDashboard() {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['con', 'dash'],
    queryFn: async () => {
      const me = session!.user.id
      const agora = new Date()
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
      const inicioMesAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
      const mesmoDiaMesAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, agora.getDate())
      const desde30 = new Date(Date.now() - 30 * 86400_000).toISOString()

      const [mes, mesAnt, porDia, vd] = await Promise.all([
        supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('consultor_id', me).eq('status', 'aprovado').gte('data_venda', diaLocal(inicioMes)),
        supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('consultor_id', me).eq('status', 'aprovado').gte('data_venda', diaLocal(inicioMesAnt)).lt('data_venda', diaLocal(mesmoDiaMesAnt)),
        supabase.from('leads').select('created_at').eq('consultor_id', me).gte('created_at', desde30).limit(2000),
        supabase.from('vendas').select('status, valor_adesao, data_venda').eq('consultor_id', me).in('status', ['aguardando_entrevista', 'aprovado']).limit(2000),
      ])
      for (const r of [mes, mesAnt, porDia, vd]) if (r.error) throw r.error

      const dias: { dia: string; n: number }[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400_000)
        dias.push({ dia: diaLocal(d), n: 0 })
      }
      for (const l of (porDia.data ?? []) as { created_at: string }[]) {
        const k = diaLocal(new Date(l.created_at))
        const d = dias.find((x) => x.dia === k)
        if (d) d.n++
      }
      const vendas = (vd.data ?? []) as { status: string; valor_adesao: number; data_venda: string }[]
      const aprovadasMes = vendas.filter((v) => v.status === 'aprovado' && v.data_venda >= diaLocal(inicioMes))
      const aguardando = vendas.filter((v) => v.status === 'aguardando_entrevista')
      return {
        vendasMes: mes.count ?? 0,
        vendasMesAnt: mesAnt.count ?? 0,
        porDia: dias,
        aprovado: aprovadasMes.reduce((a, v) => a + Number(v.valor_adesao), 0),
        aprovadoQtd: aprovadasMes.length,
        aguardando: aguardando.reduce((a, v) => a + Number(v.valor_adesao), 0),
        aguardandoQtd: aguardando.length,
      }
    },
  })
}

export type MeuIndicador = { id: string; nome: string; perfil: string | null; tipo_pessoa: string; canais: string[]; leads: number; aprovados: number; a_repassar: number; consultor_desde: string | null }

export function useMeusIndicadores() {
  return useQuery({
    queryKey: ['con', 'indicadores'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meus_indicadores')
      if (error) throw error
      return ((data ?? []) as MeuIndicador[]).map((i) => ({ ...i, leads: Number(i.leads), aprovados: Number(i.aprovados), a_repassar: Number(i.a_repassar) }))
    },
  })
}
