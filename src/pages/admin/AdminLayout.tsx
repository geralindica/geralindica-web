import { CalendarCheck, FileSignature, LayoutGrid, MessageCircle, Percent, ReceiptText, UserCog } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'
import { useNaoLidas } from '@/pages/Mensagens'

export function AdminLayout() {
  const naoLidas = useNaoLidas()
  const nav: NavItem[] = [
    { to: '/admin', label: 'Vendas e temperatura', short: 'Vendas', icon: ReceiptText, end: true },
    { to: '/admin/fechamentos', label: 'Fechamentos (dia 5)', short: 'Fechamentos', icon: CalendarCheck },
    { to: '/admin/contratos', label: 'Contratos', icon: FileSignature },
    { to: '/admin/mensagens', label: 'Mensagens', icon: MessageCircle, badge: naoLidas || undefined },
    { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
    { to: '/admin/split', label: 'Split e configurações', short: 'Split', icon: Percent },
    { to: '/admin/catalogo', label: 'Catálogo', icon: LayoutGrid },
  ]
  return <PainelLayout nav={nav} subtitulo="Plataforma · Admin" papelLabel="Operações" escuro />
}
