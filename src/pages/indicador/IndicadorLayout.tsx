import { Headset, Home, MessageCircle, QrCode, ReceiptText, UserCog } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'
import { usePerfil } from '@/auth/AuthProvider'
import { useNaoLidas } from '@/pages/Mensagens'

export function IndicadorLayout() {
  const p = usePerfil()
  const naoLidas = useNaoLidas()
  const nav: NavItem[] = [
    { to: '/indicador', label: 'Início', icon: Home, end: true },
    { to: '/indicador/qr', label: 'Meus QR Codes', short: 'QR', icon: QrCode },
    { to: '/indicador/extrato', label: 'Minhas vendas', short: 'Vendas', icon: ReceiptText },
    { to: '/indicador/consultor', label: 'Meu consultor', short: 'Consultor', icon: Headset },
    { to: '/indicador/mensagens', label: 'Mensagens', short: 'Chat', icon: MessageCircle, badge: naoLidas || undefined },
    { to: '/indicador/dados', label: 'Meus dados', short: 'Dados', icon: UserCog },
  ]
  return <PainelLayout nav={nav} subtitulo="Indicador" papelLabel={`Indicador · ${p.tipo_pessoa}`} barraInferior largura={960} />
}
