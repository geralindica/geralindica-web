import { Landmark, LayoutGrid, Percent, UserCog } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'

const nav: NavItem[] = [
  { to: '/admin', label: 'Financeiro', icon: Landmark, end: true },
  { to: '/admin/split', label: 'Split e impostos', short: 'Split', icon: Percent },
  { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { to: '/admin/catalogo', label: 'Catálogo', icon: LayoutGrid },
]

export function AdminLayout() {
  return <PainelLayout nav={nav} subtitulo="Plataforma · Admin" papelLabel="Operações" escuro />
}
