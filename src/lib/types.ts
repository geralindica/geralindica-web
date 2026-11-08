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

/** Venda registrada pelo consultor (o dinheiro nunca passa pela plataforma). */
export type StatusVenda = 'aguardando_entrevista' | 'aprovado' | 'reprovado' | 'estornado'

export type Profile = {
  id: string
  papel: Papel
  nome: string
  tipo_pessoa: TipoPessoa
  documento: string | null
  telefone: string | null
  email: string | null
  /** Preenchido só quando o contrato fica vigente (a Geralindica confere no final). */
  contrato_assinado_em: string | null
  /** Pedidos pelos contratos do Luis (qualificação das partes). */
  rg: string | null
  endereco: string | null
  /** Consultor: comprovante de habilitação ou vínculo com corretora (cláusula 2.3). */
  habilitacao_arquivo: string | null
  habilitacao_enviada_em: string | null
  /** Removido do site pela Geralindica. */
  suspenso_em: string | null
  suspenso_motivo: string | null
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
  /** Liberado pelo admin; sem isso não aparece na vitrine nem recebe indicadores. */
  aprovado: boolean
  vendas: number
  leads_total: number
  vendas_30d: number
  ocupacao: number
  /** Reputação pública de 0 a 100 (calculada no banco, em private.calcular_temperatura). */
  temperatura: number
  administradora: string | null
  /** Consultor PJ: faixa de imposto (1 = aliquota_pj, 2 = aliquota_pj_2). */
  faixa_pj: 1 | 2
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
  tipo: 'consultor' | 'cliente' | 'sistema' | 'nota'
  texto: string
  created_at: string
}

/** Venda vista pelo indicador: sem dado pessoal do cliente além do primeiro nome. */
export type VendaIndicador = {
  venda_id: string
  cliente: string
  data_venda: string
  canal: string | null
  consultor: string
  status: StatusVenda
  valor_adesao: number
  /** Quanto o consultor deve repassar ao indicador. Só informativo. */
  estimativa: number
  tipo: TipoVenda
  /** false = fechada mais de 90 dias depois do registro do lead (sem parte do indicador). */
  indicacao_valida: boolean
  aprovado_em: string | null
  estornado_em: string | null
  indicador_pago_em: string | null
}

export type TipoVenda = 'nova' | 'troca_plano'

export type Venda = {
  id: string
  consultor_id: string
  lead_id: string | null
  indicador_id: string | null
  canal_id: string | null
  cliente: string
  valor_adesao: number
  data_venda: string
  status: StatusVenda
  /** Imposto do consultor gravado ao registrar a venda (%). */
  aliquota: number
  /** Bonificação da operadora depois do Verdinho (% do valor da adesão). */
  bonificacao_pct: number | null
  tipo: TipoVenda
  venda_origem: string | null
  indicacao_valida: boolean
  aprovado_em: string | null
  estornado_em: string | null
  indicador_pago_em: string | null
  created_at: string
  updated_at: string
}

export type Recebimento = { id: string; venda_id: string; valor: number; aliquota: number; recebido_em: string; descricao: string | null }

export type EtapaContrato = 'parte' | 'consultor' | 'geralindica' | 'vigente' | 'encerrado'

export type ParteContrato = {
  nome: string
  tipo_pessoa: TipoPessoa
  documento: string | null
  rg: string | null
  endereco: string | null
  email: string | null
  telefone: string | null
}

/** Tudo o que o PDF do contrato precisa (public.contrato_dados). */
export type DadosContrato = {
  id: string
  tipo: 'indicador' | 'consultor'
  etapa: EtapaContrato
  versao: string
  arquivo: string | null
  observacao: string | null
  created_at: string
  parte_assinou_em: string | null
  consultor_assinou_em: string | null
  vigente_em: string | null
  parte: ParteContrato
  consultor: ParteContrato
  testemunhas: { nome: string | null; cpf: string | null; email: string | null }[]
}

export type Fechamento = {
  consultor_id: string
  consultor: string
  mes: string
  vencimento: string
  valor: number
  pago_em: string | null
  valor_pago: number | null
  dias_atraso: number
  juros: number
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

export type ConfigSplit = {
  id: number
  /** Imposto do consultor. null = ainda não definido (o admin preenche em Admin → Split). */
  aliquota_pf: number | null
  /** PJ, faixa 1 e faixa 2. */
  aliquota_pj: number | null
  aliquota_pj_2: number | null
  pct_indicador: number
  /** Do bolo (parte do consultor na adesão + bonificação líquida), % do consultor; o resto é da Geralindica. */
  pct_consultor_restante: number | null
  /** Bonificação sugerida ao registrar venda aprovada (% do valor da adesão). */
  bonificacao_padrao: number | null
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
