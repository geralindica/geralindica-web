// Pontos de encaixe das integrações externas.
//
// Hoje rodam em MODO SIMULADO: registram o que aconteceria no histórico do lead / no banco,
// sem chamar serviços de terceiros. Para ativar a integração real, troque o corpo da função
// mantendo a assinatura (as telas não mudam). Detalhes em src/integrations/README.md.
import { supabase } from '@/lib/supabase'

export const MODO_SIMULADO = true

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function registrarEvento(leadId: string, tipo: 'robo' | 'pdf' | 'consultor' | 'sistema' | 'nota', texto: string) {
  const { error } = await supabase.from('lead_eventos').insert({ lead_id: leadId, tipo, texto })
  if (error) throw error
}

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

/**
 * Robô reenvia a cotação em PDF ao cliente.
 * Real: chamar a API oficial da Meta / ManyChat com o template "cotacao_pdf".
 */
export async function reenviarCotacao(leadId: string) {
  await espera(500)
  await registrarEvento(leadId, 'pdf', 'Cotação reenviada no WhatsApp pelo robô')
}

/**
 * Reengajamento da fila de recuperação (o robô faz sozinho após 48h).
 * Real: disparar o template de reengajamento pela API do WhatsApp.
 */
export async function reengajarLead(leadId: string) {
  await espera(400)
  const { error } = await supabase.from('leads').update({ reengajado_em: new Date().toISOString() }).eq('id', leadId)
  if (error) throw error
  await registrarEvento(leadId, 'robo', 'Mensagem de reengajamento enviada (contato antecipado pelo consultor)')
}

// ---------------- Cotaí ----------------
export type Alternativa = 'municipal' | 'coparticipacao' | 'semObst' | 'dependentes'
export const ALTERNATIVAS: { id: Alternativa; label: string; fator: number }[] = [
  { id: 'municipal', label: 'Municipal', fator: 0.18 },
  { id: 'coparticipacao', label: 'Coparticipação', fator: 0.22 },
  { id: 'semObst', label: 'Sem obstetrícia', fator: 0.08 },
  { id: 'dependentes', label: 'Incluir dependentes', fator: -0.6 },
]

/** Estimativa local da mensalidade com as alternativas marcadas (antes de consultar o Cotaí). */
export function estimarMensalidade(base: number, alts: Alternativa[]) {
  return ALTERNATIVAS.reduce((v, a) => (alts.includes(a.id) ? v * (1 - a.fator) : v), base)
}

/**
 * Gera nova cotação com as alternativas escolhidas e envia ao cliente.
 * Real: login com as credenciais da corretora no Cotaí, extrair as opções e gerar o PDF.
 */
export async function gerarNovaCotacao(leadId: string, alts: Alternativa[], mensalidade: string) {
  await espera(700)
  const nomes = ALTERNATIVAS.filter((a) => alts.includes(a.id)).map((a) => a.label.toLowerCase())
  await registrarEvento(leadId, 'pdf', `Nova cotação enviada${nomes.length ? ` (${nomes.join(', ')})` : ''} · estimativa ${mensalidade}/mês`)
}

// ---------------- Administradora ----------------
/**
 * Pedido de desconto na taxa de adesão (15% a 50%).
 * Real: e-mail/API da Administradora para reemissão do contrato.
 */
export async function pedirDescontoAdministradora(leadId: string, pct: number) {
  await espera(400)
  const { error } = await supabase.from('leads').update({ desconto_pct: pct, desconto_status: 'solicitado' }).eq('id', leadId)
  if (error) throw error
  await registrarEvento(leadId, 'consultor', `Pedido de ${pct}% de desconto na taxa de adesão enviado à Administradora`)
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

// ---------------- Pagamentos ----------------
/**
 * Saque via Pix das comissões em Verdinho.
 * Hoje o banco marca como repassado na hora (Pix simulado).
 * Real: o gateway (Stripe, PicPay ou banco) faz o Pix e confirma por webhook.
 */
export async function sacarViaPix() {
  const { data, error } = await supabase.rpc('solicitar_saque')
  if (error) throw error
  return data as { id: string; valor: number; qtd: number; created_at: string }
}
