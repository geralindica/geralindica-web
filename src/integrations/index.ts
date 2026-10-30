// Pontos de encaixe das integrações externas.
//
// A plataforma não tem robô de WhatsApp, Cotaí nem pagamento (modelo de 27/10/2026): o consultor atende
// o cliente e faz os Pix por fora. Sobram o link do WhatsApp (real) e o Gov.br (simulado).
// Para ativar uma integração real, troque o corpo da função mantendo a assinatura. Detalhes em README.md.

export const MODO_SIMULADO = true

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

// ---------------- Gov.br ----------------
/**
 * Assinatura do contrato com a conta Gov.br (nível prata/ouro).
 * Real: redirecionar ao Assinador Gov.br (API de assinatura eletrônica) e tratar o retorno.
 */
export async function assinarContratoGovBr(): Promise<{ assinadoEm: string }> {
  await espera(1200)
  return { assinadoEm: new Date().toISOString() }
}
