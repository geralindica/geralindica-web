import { Headset, Home, QrCode, ReceiptText, Wallet } from 'lucide-react'
import { PainelLayout, type NavItem } from '@/components/painel/PainelLayout'
import { usePerfil } from '@/auth/AuthProvider'

const nav: NavItem[] = [
  { to: '/indicador', label: 'Início', icon: Home, end: true },
  { to: '/indicador/qr', label: 'Meus QR Codes', short: 'QR Codes', icon: QrCode },
  { to: '/indicador/extrato', label: 'Extrato', icon: ReceiptText },
  { to: '/indicador/consultor', label: 'Meu consultor', short: 'Consultor', icon: Headset },
  { to: '/indicador/saques', label: 'Saques', icon: Wallet },
]

export function IndicadorLayout() {
  const p = usePerfil()
  return <PainelLayout nav={nav} subtitulo="Indicador" papelLabel={`Indicador · ${p.tipo_pessoa}`} barraInferior largura={960} />
}
