import { KanbanSquare, LayoutDashboard, Store, Users } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'
import { useConsultores } from '@/data/queries'
import { usePerfil } from '@/auth/AuthProvider'
import { useLeadsCRM, useMeuConsultor } from './dados'
import { ETAPAS_FINAIS } from '@/lib/negocio'

export function ConsultorLayout() {
  const p = usePerfil()
  const me = useMeuConsultor()
  const leads = useLeadsCRM()
  const ranking = useConsultores()
  const ativos = (leads.data ?? []).filter((l) => !ETAPAS_FINAIS.includes(l.etapa)).length
  const rank = ranking.data?.find((c) => c.id === p.id)?.rank

  const nav: NavItem[] = [
    { to: '/consultor', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/consultor/leads', label: 'Leads', icon: KanbanSquare, badge: ativos || undefined },
    { to: '/consultor/indicadores', label: 'Meus indicadores', short: 'Indicadores', icon: Users },
    { to: '/consultor/perfil', label: 'Perfil público', short: 'Perfil', icon: Store },
  ]

  const c = me.data
  const pct = c ? Math.min(100, Math.round((c.ocupacao / c.max_indicadores) * 100)) : 0
  return (
    <PainelLayout
      nav={nav}
      subtitulo="Consultor"
      papelLabel={c ? `${c.temperatura}° de temperatura${rank ? ` · #${rank}` : ''}` : 'Consultor'}
      foto={c?.foto_url}
      rodapeExtra={
        c && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-ink-50 p-3.5">
            <div className="flex justify-between text-[12px] font-bold">
              <span className="text-ink-600">Vagas</span>
              <span>
                {c.ocupacao}/{c.max_indicadores}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-200">
              <div className="h-full bg-verde-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      }
    />
  )
}
