export type Papel = 'indicador' | 'consultor' | 'admin'
export type TipoPessoa = 'PF' | 'PJ'

export type Etapa =
  | 'novo'
  | 'triagem'
  | 'cotacao'
  | 'negociacao'
  | 'contrato'
  | 'custodia'
  | 'entrevista'
  | 'aprovado'
  | 'reprovado'
  | 'perdido'

export type StatusTx = 'pendente' | 'custodia' | 'verdinho' | 'repassado' | 'estornado'

export type Profile = {
  id: string
  papel: Papel
  nome: string
  tipo_pessoa: TipoPessoa
  documento: string | null
  telefone: string | null
  chave_pix: string | null
  email: string | null
  contrato_assinado_em: string | null
  created_at: string
}

export type ConsultorRow = {
  id: string
  nome_exibicao: string
  cidade: string | null
  susep: string | null
  bio: string | null
  especialidades: string[]
  foto_url: string | null
  max_indicadores: number
  nota: number | null
  publicado: boolean
  vendas: number
  leads_total: number
  vendas_30d: number
  ocupacao: number
  administradora: string | null
}

/** Consultor já com ranking e campos derivados para a interface. */
export type Consultor = ConsultorRow & {
  rank: number
  conv: number
  full: boolean
  vagas: number
  pct: number
  barColor: string
  vagaLabel: string
  hot: boolean
  top: boolean
  photo: string
  primeiroNome: string
}

export type Lead = {
  id: string
  consultor_id: string
  indicador_id: string | null
  canal_id: string | null
  nome: string
  cpf: string | null
  telefone: string | null
  plano: string | null
  valor_adesao: number | null
  etapa: Etapa
  triagem: Record<string, string>
  triagem_passo: number
  abandonou_em: string | null
  reengajado_em: string | null
  desconto_pct: number | null
  desconto_status: 'solicitado' | 'aprovado' | 'recusado' | null
  created_at: string
  updated_at: string
}

export type LeadComOrigem = Lead & {
  canal: { codigo: string; numero: number; nome: string } | null
  indicador: { nome: string } | null
}

export type LeadEvento = {
  id: string
  lead_id: string
  tipo: 'robo' | 'pdf' | 'consultor' | 'cliente' | 'sistema' | 'nota'
  texto: string
  created_at: string
}

export type ExtratoItem = {
  transacao_id: string
  primeiro_nome: string
  data: string
  canal: string | null
  status: StatusTx
  bruto: number
  aliquota: number
  comissao: number
  cpf_final: string
  tel_final: string
}

export type Canal = {
  id: string
  indicador_id: string
  codigo: string
  nome: string
  numero: number
  escaneamentos: number
  created_at: string
}

export type Saque = { id: string; indicador_id: string; valor: number; qtd: number; created_at: string }

export type ConfigSplit = {
  id: number
  aliquota_pf: number
  aliquota_pj: number
  pct_indicador: number
  pct_consultor_restante: number
  whatsapp_numero: string
}

export type Avaliacao = { id: string; consultor_id: string; autor: string; estrelas: number; texto: string; created_at: string }

export type Produto = {
  id: string
  nome: string
  descricao: string
  icone: string
  status: 'ativo' | 'em_breve'
  previsao: string | null
  lista_espera: boolean
  ordem: number
}
