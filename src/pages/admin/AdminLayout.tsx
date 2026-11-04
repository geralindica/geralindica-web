import { LayoutGrid, Percent, ReceiptText, UserCog } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'

const nav: NavItem[] = [
  { to: '/admin', label: 'Vendas e temperatura', short: 'Vendas', icon: ReceiptText, end: true },
  { to: '/admin/split', label: 'Split e configurações', short: 'Split', icon: Percent },
  { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { to: '/admin/catalogo', label: 'Catálogo', icon: LayoutGrid },
]

export function AdminLayout() {
  return <PainelLayout nav={nav} subtitulo="Plataforma · Admin" papelLabel="Operações" escuro />
}
