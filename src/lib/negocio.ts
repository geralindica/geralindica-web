// Regras de negócio puras da Geralindica. Nada de valor escrito à mão nas telas:
// tudo passa por estas funções (a mesma fórmula do indicador existe no banco, em private.estimativa_indicador()).
// A plataforma não movimenta dinheiro: os valores aqui são estimativas do que o consultor repassa por fora.
import type { Consultor, ConsultorRow, Etapa, StatusVenda } from './types'

export const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * Split de uma venda: valor − imposto = líquido → % indicador / restante (consultor + Geralindica).
 * Os percentuais vêm da configuração do admin (config_split). Imposto não definido conta como zero;
 * divisão consultor x Geralindica não definida devolve null nessas duas partes.
 */
export function calcularSplit(bruto: number, aliquotaPct: number | null, pctIndicador: number, pctConsultorDoResto: number | null) {
  const imposto = round2((bruto * (aliquotaPct ?? 0)) / 100)
  const liquido = round2(bruto - imposto)
  const indicador = round2((liquido * pctIndicador) / 100)
  const resto = round2(liquido - indicador)
  const consultor = pctConsultorDoResto == null ? null : round2((resto * pctConsultorDoResto) / 100)
  return { bruto, imposto, liquido, indicador, resto, consultor, plataforma: consultor == null ? null : round2(resto - consultor) }
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

export function iniciais(nome: string, max = 2) {
  return nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .map((p) => p[0]?.toUpperCase())
    .slice(0, max)
    .join('')
}

/** LGPD: só os 2 últimos dígitos do CPF ficam visíveis. */
export const mascararCPF = (final: string | null | undefined) => `***.***.***-${final || '**'}`
export const mascararTelefone = (final: string | null | undefined) => `(**) *****-${final || '****'}`

export function mascararCPFCompleto(cpf: string | null) {
  const d = (cpf ?? '').replace(/\D/g, '')
  return d.length >= 11 ? `***.${d.slice(3, 6)}.***-${d.slice(9, 11)}` : '—'
}
export function mascararTelefoneCompleto(tel: string | null) {
  const d = (tel ?? '').replace(/\D/g, '')
  return d.length >= 10 ? `(${d.slice(0, 2)}) 9****-${d.slice(-4)}` : '—'
}

// ---------- Máscaras de digitação ----------
export function formatarCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
export function formatarCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
export function formatarTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export function cpfValido(cpf: string) {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function cnpjValido(cnpj: string) {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

// ---------- Etapas do funil (CRM) ----------
export const ETAPAS: { id: Etapa; nome: string; dot: string; bg: string; kanban: boolean }[] = [
  { id: 'novo', nome: 'Novo', dot: '#8494A8', bg: '#EAEFF5', kanban: true },
  { id: 'triagem', nome: 'Em triagem', dot: '#3B7BE8', bg: '#EAEFF5', kanban: true },
  { id: 'cotacao', nome: 'Cotação enviada', dot: '#3B7BE8', bg: '#EAEFF5', kanban: true },
  { id: 'negociacao', nome: 'Negociação', dot: '#3B7BE8', bg: '#EAEFF5', kanban: true },
  { id: 'contrato', nome: 'Contrato emitido', dot: '#3B7BE8', bg: '#EAEFF5', kanban: true },
  { id: 'custodia', nome: 'Pagamento recebido', dot: '#F2A516', bg: '#FFF8E8', kanban: true },
  { id: 'entrevista', nome: 'Entrevista de saúde', dot: '#F2A516', bg: '#FFF8E8', kanban: true },
  { id: 'aprovado', nome: 'Aprovado (Verdinho)', dot: '#FFFFFF', bg: '#0F9D58', kanban: true },
  { id: 'reprovado', nome: 'Reprovado (devolvido)', dot: '#E2574C', bg: '#FDF3F2', kanban: true },
  { id: 'perdido', nome: 'Perdido (desistiu)', dot: '#8494A8', bg: '#EAEFF5', kanban: false },
]
export const nomeEtapa = (e: Etapa) => ETAPAS.find((x) => x.id === e)?.nome ?? e
export const ETAPAS_FINAIS: Etapa[] = ['aprovado', 'reprovado', 'perdido']

/** Cores do selo de etapa (detalhe do lead / painel). */
export function corEtapa(e: Etapa) {
  const dot = ETAPAS.find((x) => x.id === e)?.dot
  if (e === 'aprovado') return { bg: '#0F9D58', fg: '#fff', dot: '#fff' }
  if (dot === '#F2A516') return { bg: '#FFF3D6', fg: '#9A5B00', dot }
  if (dot === '#3B7BE8') return { bg: '#E7EFFC', fg: '#1F5BBF', dot }
  if (dot === '#E2574C') return { bg: '#FCEAE8', fg: '#B3372F', dot }
  return { bg: '#EAEFF5', fg: '#1F2E45', dot: '#8494A8' }
}

// ---------- Status da venda registrada (badge) ----------
export const STATUS_VENDA: Record<StatusVenda, { label: string; bg: string; fg: string; avBg: string; avFg: string; nota: string }> = {
  aguardando_entrevista: { label: 'Aguardando entrevista', bg: '#FFF3D6', fg: '#9A5B00', avBg: '#FFF3D6', avFg: '#9A5B00', nota: 'O cliente pagou ao consultor, que segura o valor até a entrevista de saúde.' },
  aprovado: { label: 'Verdinho ✓', bg: '#0F9D58', fg: '#fff', avBg: '#ECF8F1', avFg: '#0A7F47', nota: 'Entrevista aprovada. O consultor faz o Pix da sua parte.' },
  reprovado: { label: 'Reprovado', bg: '#FCEAE8', fg: '#B3372F', avBg: '#FCEAE8', avFg: '#B3372F', nota: 'Cliente reprovado na entrevista de saúde. O consultor devolveu o valor; não há comissão.' },
}
export const STATUS_VENDA_OPCOES: { v: StatusVenda; label: string }[] = [
  { v: 'aguardando_entrevista', label: 'Aguardando entrevista' },
  { v: 'aprovado', label: 'Aprovado no Verdinho' },
  { v: 'reprovado', label: 'Reprovado e devolvido' },
]

// ---------- Temperatura (reputação do consultor) ----------
// O número (0 a 100) vem pronto do banco. Aqui só as faixas para exibir. PROVISÓRIO, como a fórmula.
export function faixaTemperatura(t: number) {
  if (t >= 70) return { label: 'Quente', bg: '#FDECE7', fg: '#B83A12', barra: '#E8572A' }
  if (t >= 40) return { label: 'Morna', bg: '#FFF3D6', fg: '#9A5B00', barra: '#F2A516' }
  return { label: 'Fria', bg: '#E7EFFC', fg: '#1F5BBF', barra: '#3B7BE8' }
}

// ---------- Consultores: ranking e vagas ----------
/** "Top 10": entre os 10 primeiros do ranking e com ao menos 75 vendas aprovadas. */
const TOP_MIN_VENDAS = 75
/** "Em alta": 5 ou mais adesões aprovadas nos últimos 30 dias. */
const EM_ALTA_30D = 5

export function corVagas(full: boolean, vagas: number) {
  if (full) return '#8494A8'
  return vagas <= 3 ? '#9A5B00' : '#0A7F47'
}

export function enriquecerConsultores(rows: ConsultorRow[]): Consultor[] {
  return [...rows]
    .sort((a, b) => b.temperatura - a.temperatura || b.vendas - a.vendas)
    .map((c, i) => {
      const vagas = Math.max(0, c.max_indicadores - c.ocupacao)
      const full = vagas === 0
      return {
        ...c,
        rank: i + 1,
        conv: c.leads_total ? Math.round((c.vendas * 100) / c.leads_total) : 0,
        full,
        vagas,
        pct: Math.min(100, Math.round((c.ocupacao / c.max_indicadores) * 100)),
        barColor: corVagas(full, vagas),
        vagaLabel: full ? 'Lotado' : `${vagas} ${vagas === 1 ? 'vaga' : 'vagas'}`,
        hot: c.vendas_30d >= EM_ALTA_30D,
        top: i < 10 && c.vendas >= TOP_MIN_VENDAS,
        photo: c.foto_url || '',
        primeiroNome: primeiroNome(c.nome_exibicao),
      }
    })
}

// ---------- Tempo ----------
export function tempoDesde(iso: string, agora = Date.now()) {
  const s = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 1000))
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
export const dataHoraBR = (iso: string) =>
  `${new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

export const pct = (v: number) => `${String(v).replace('.', ',')}%`
