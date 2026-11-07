// Pontos de encaixe das integrações externas.
//
// A plataforma não tem robô de WhatsApp, Cotaí nem pagamento (modelo de 27/10/2026): o consultor atende
// o cliente e faz os Pix por fora. Sobra o link do WhatsApp. O contrato Gov.br é manual: a pessoa assina o PDF
// em assinador.iti.br e envia pelo painel (src/components/painel/Contrato.tsx); o admin confere em Usuários.

// ---------------- WhatsApp ----------------
/** Link real do WhatsApp (wa.me) com mensagem pronta. Funciona sem integração. */
export function linkWhatsApp(numero: string, mensagem: string) {
  const n = numero.replace(/\D/g, '')
  return `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`
}

/** Telefone brasileiro para o formato internacional do wa.me. */
export function numeroInternacional(telefone: string | null) {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('55') ? d : `55${d}`
}
