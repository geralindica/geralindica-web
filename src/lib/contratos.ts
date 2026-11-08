// Contratos do Luis Novinho (recebidos em 07/11/2026), com os campos preenchidos pelo cadastro.
// O texto é o dele: só foram corrigidos erros de digitação. Mudou o texto? Suba VERSAO_TEXTO; quem já assinou
// continua na versão que assinou (o PDF assinado fica guardado no bucket "contratos").
// O PDF é gerado no navegador (jsPDF, carregado só na hora) e assinado no assinador.iti.br.
import type { DadosContrato, ParteContrato } from './types'

export const VERSAO_TEXTO = '1 · 08/11/2026'
export const FORO = 'Rio de Janeiro/RJ'
export const ASSINADOR_GOVBR = 'https://assinador.iti.br'
const GERALINDICA =
  'GERALINDICA, inscrita no CNPJ sob o nº 68.110.529/0001-00, sem sede física, com atuação exclusivamente digital pelo site geralindica.com.br'

type Bloco = { t: 'titulo' | 'secao' | 'clausula' | 'p' | 'item' | 'local'; texto: string } | { t: 'assinaturas'; linhas: { papel: string; nome: string; doc: string }[] } | { t: 'testemunhas' }

const vazio = '________________'
const val = (v: string | null | undefined) => (v && v.trim() ? v.trim() : vazio)
const rotuloDoc = (p: ParteContrato) => (p.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF')

function qualificacao(p: ParteContrato, final: string, residente = false) {
  const rg = p.tipo_pessoa === 'PJ' && !p.rg ? '' : `, portador(a) do RG nº ${val(p.rg)}`
  return `${val(p.nome)}, inscrito(a) no ${rotuloDoc(p)} sob o nº ${val(p.documento)}${residente ? `${rg}, residente e domiciliado(a) em ${val(p.endereco)}` : `, com domicílio/sede em ${val(p.endereco)}${rg}`}, e-mail ${val(p.email)} e telefone ${val(p.telefone)}, doravante denominado(a) ${final}.`
}

const dataExtenso = (d = new Date()) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export function blocosIndicador(d: DadosContrato): Bloco[] {
  const c = d.consultor
  const i = d.parte
  return [
    { t: 'titulo', texto: 'INSTRUMENTO PARTICULAR DE PARCERIA COMERCIAL DE INDICAÇÃO DE LEADS' },
    { t: 'secao', texto: 'CONTRATANTE' },
    { t: 'p', texto: qualificacao(c, 'CONTRATANTE') },
    { t: 'secao', texto: 'CONTRATADO(A) / PARCEIRO(A)' },
    { t: 'p', texto: qualificacao(i, 'PARCEIRO(A)', true) },
    { t: 'p', texto: 'As partes acima qualificadas, de comum acordo, celebram o presente Contrato de Parceria Comercial, que se regerá mediante as cláusulas e condições seguintes:' },
    { t: 'clausula', texto: 'CLÁUSULA PRIMEIRA – DO OBJETO' },
    { t: 'p', texto: '1.1. O presente contrato tem por objeto a formalização de parceria comercial autônoma, sem geração de vínculo empregatício, consistindo na indicação de potenciais clientes (leads) pelo(a) PARCEIRO(A) à CONTRATANTE, por meio de tecnologia de QR Code ou link personalizado.' },
    { t: 'p', texto: '1.2. A atuação do(a) PARCEIRO(A) restringe-se exclusivamente à captação e direcionamento de contatos interessados em simulações de planos de saúde, cabendo à CONTRATANTE (ou à corretora/consultor parceiro devidamente habilitado) a condução técnica da consultoria, simulação, negociação e fechamento do contrato de plano de saúde.' },
    { t: 'clausula', texto: 'CLÁUSULA SEGUNDA – DA FORMA DE ATUAÇÃO E AUSÊNCIA DE VÍNCULO EMPREGATÍCIO' },
    { t: 'p', texto: '2.1. O(A) PARCEIRO(A) que vai trabalhar com as indicações exercerá suas atividades de forma autônoma e independente, utilizando seus próprios meios, sem qualquer subordinação hierárquica, habitualidade, exclusividade ou fixação de jornada de trabalho em relação à CONTRATANTE.' },
    { t: 'p', texto: '2.2. Fica expressamente ajustado que não há qualquer vínculo empregatício, societário ou de representação comercial obrigatória entre as partes, arcando o(a) PARCEIRO(A) com todos os custos, tributos e despesas decorrentes de sua própria atividade.' },
    { t: 'p', texto: '2.3. O(A) PARCEIRO(A) está expressamente proibido(a) de negociar preços, prometer coberturas específicas, firmar contratos, usar a marca da operadora de saúde, se apresentar como corretor(a) ou receber quaisquer valores em nome da parte CONTRATANTE ou das operadoras de planos de saúde.' },
    { t: 'clausula', texto: 'CLÁUSULA TERCEIRA – DA CONDIÇÃO DE EFETIVIDADE, REMUNERAÇÃO E FORMA DE CÁLCULO' },
    { t: 'p', texto: '3.1. O pagamento referente ao marketing de indicações será realizado ao(à) PARCEIRO(A) que realizar as indicações e só será realizado após a pessoa indicada ter efetivamente contratado e pago o plano de saúde, ter sido aprovada pela operadora de saúde e estar apta a utilizar os serviços do plano de saúde (após o término de eventuais prazos de carência e/ou vigência inicial regular).' },
    { t: 'p', texto: '3.2. Como retribuição referente ao marketing de indicações que resultem em contratos efetivamente implantados, o(a) PARCEIRO(A) fará jus a um pagamento que será calculado exclusivamente sobre o lucro líquido obtido na primeira parcela paga pelo cliente (ou taxa de adesão, conforme o caso), sendo de responsabilidade do consultor ou consultora de plano de saúde destinatário a realização deste pagamento.' },
    { t: 'p', texto: '3.3. A base de cálculo para realizar o pagamento referente ao marketing de indicações das pessoas ou empresas que vão realizar as indicações seguirá rigorosamente os tributos efetivamente incidentes:' },
    { t: 'item', texto: 'Passo A: Apuração do valor bruto da comissão da primeira parcela/adesão recebida.' },
    { t: 'item', texto: 'Passo B: Dedução da carga tributária incidente (impostos e encargos fiscais correlatos), resultando no saldo remanescente de lucro líquido do consultor, que será dividido entre o consultor e o(a) PARCEIRO(A).' },
    { t: 'item', texto: 'Passo C: Sobre o lucro líquido pós-impostos obtido no Passo B, será aplicada a divisão de 50% (cinquenta por cento) para a CONTRATANTE e 50% (cinquenta por cento) a título de pagamento para o(a) PARCEIRO(A) referente ao marketing de indicações.' },
    { t: 'p', texto: '3.4. O pagamento ocorrerá em até 5 (cinco) dias úteis após o(a) consultor(a) obter a compensação efetiva do recebimento da sua comissão e constatação da efetividade do plano de saúde pelo cliente, mediante transferência bancária para a conta indicada pelo(a) PARCEIRO(A) que vai realizar o marketing de indicações.' },
    { t: 'p', texto: '3.5. O consultor ou consultora apresentará ao(à) PARCEIRO(A) que vai realizar o marketing de indicações os valores das comissões de cada plano vendido e gerará uma planilha com os valores gerados, preservando estritamente os dados pessoais dos contratantes em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).' },
    { t: 'clausula', texto: 'CLÁUSULA QUARTA – DA DEFINIÇÃO DE "LEAD VÁLIDO" E REGRAS DE CADASTRO' },
    { t: 'p', texto: '4.1. Para os fins deste contrato, considera-se "Lead Válido" o contato de potencial cliente que preencha cumulativamente os seguintes requisitos:' },
    { t: 'item', texto: 'a) Realize a contratação e o fechamento do plano de saúde no prazo máximo de até 90 (noventa) dias contados a partir da data do primeiro contato ou registro da indicação gerada pelo link/QR code. Após este prazo, a indicação perderá a validade para fins de comissionamento.' },
    { t: 'clausula', texto: 'CLÁUSULA QUINTA – DOS ESTORNOS, CANCELAMENTOS E ENCARGOS MORATÓRIOS' },
    { t: 'p', texto: '5.1. Caso ocorra o distrato, cancelamento, desistência do cliente ou estorno da primeira parcela/taxa de adesão por parte da operadora de saúde, o valor correspondente deverá ser restituído pelo(a) PARCEIRO(A) ao consultor(a) do plano de saúde em até 3 (três) dias úteis contados da notificação, sem prejuízo da compensação em créditos futuros.' },
    { t: 'p', texto: '5.2. Em caso de atraso injustificado no cumprimento de quaisquer obrigações de pagamento ou restituição previstas neste instrumento por qualquer das partes, incidirão sobre o valor devido multa moratória de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês, calculados pro rata die até a data do efetivo pagamento, valendo esta regra de forma equânime para ambos os contratantes.' },
    { t: 'p', texto: '5.3. Na hipótese de o atendimento e fechamento do contrato serem realizados por um consultor parceiro, será de inteira e exclusiva responsabilidade do referido consultor parceiro efetuar o pagamento da respectiva participação financeira sobre o lucro da primeira mensalidade ou taxa de adesão diretamente ao(à) PARCEIRO(A) ou à pessoa ou à empresa que realizou a indicação do cliente que contratou os serviços dos planos de saúde, desobrigando integralmente o site pelo pagamento do marketing de indicações sobre esta parcela de indicações de clientes especificada no contrato, tendo em vista que a plataforma tem como papel desenvolver um meio de comunicação entre o consultor de plano de saúde e a empresa ou pessoa que vai realizar o marketing de indicações dos clientes que podem vir a contratar o plano de saúde.' },
    { t: 'clausula', texto: 'CLÁUSULA SEXTA – DA ATUAÇÃO DE CONSULTORES PARCEIROS E FLUXO DE COMUNICAÇÃO' },
    { t: 'p', texto: '6.1. Os leads direcionados pelo(a) PARCEIRO(A) serão atendidos por um(a) consultor(a) de planos de saúde parceiro(a) que integra o projeto conjuntamente.' },
    { t: 'p', texto: '6.2. Os parceiros de indicação (que vão realizar o marketing de indicação) serão previamente informados sobre qual consultor estará responsável pelo atendimento de seus links específicos.' },
    { t: 'p', texto: '6.3. Na hipótese de atendimento por consultor parceiro, será de exclusiva responsabilidade deste efetuar o pagamento diretamente ao(à) PARCEIRO(A), desobrigando a plataforma central pelos valores específicos daquela venda, visto que o papel tecnológico restringe-se ao meio de comunicação como uma ferramenta que vai realizar uma ponte entre as pessoas ou empresas que vão realizar o marketing de indicações e o(a) consultor(a) do plano de saúde.' },
    { t: 'p', texto: '6.4. O e-mail e o número de WhatsApp oficiais para contato e alinhamento operacional entre as partes serão inicialmente informados e cadastrados por meio de interação iniciada através do site oficial, tendo continuidade e validação definitiva através das conversas subsequentes realizadas pelos canais de mensagens entre os consultores e os indicadores como por exemplo: chats internos no site que quando uma das partes entrar em contato com a outra será informada no WhatsApp para que a parte que foi chamada entre em contato com a outra o quanto antes. Dentro dessa conversa não poderá ser informado: a sua profissão, como realiza o marketing de indicações, o número do telefone, e-mail ou qualquer outra rede social ou meio de se comunicar fora do chat e essa conversa será monitorada pelo site através de robôs (Bots). A ideia dessa conversa é somente realizar a troca de informações sobre os ganhos financeiros da pessoa ou empresa que está realizando o marketing de divulgação ou número de conta corrente; caso as regras sejam desrespeitadas, o contrato do consultor e da pessoa ou empresa que realiza o marketing de indicações será automaticamente cancelado e os dois serão retirados do site.' },
    { t: 'clausula', texto: 'CLÁUSULA SÉTIMA – DA PROPRIEDADE INTELECTUAL, DA BASE DE LEADS E TERMO DE ADESÃO' },
    { t: 'p', texto: '7.1. Os códigos de acesso, links personalizados, QR Codes e a integralidade da base de dados de leads gerados pertencem exclusivamente à CONTRATANTE, sendo cedidos ao(à) PARCEIRO(A) a título precário, revogável e não exclusivo.' },
    { t: 'p', texto: '7.2. Fica expressamente vedado ao(à) PARCEIRO(A) continuar utilizando os códigos, marcas ou base de dados após o encerramento ou rescisão deste contrato.' },
    { t: 'p', texto: '7.3. O(A) consultor(a) CONTRATANTE obriga-se a formalizar e assinar um termo de adesão/anexo próprio assumindo expressamente as obrigações operacionais e financeiras perante cada pessoa ou empresa que vai realizar o marketing de indicações vinculado à sua rede de atendimento.' },
    { t: 'clausula', texto: 'CLÁUSULA OITAVA – DA PRESTAÇÃO DE CONTAS' },
    { t: 'p', texto: '8.1. A CONTRATANTE ou o(a) consultor(a) de plano de saúde fica responsável por disponibilizar um relatório mensal ao(à) PARCEIRO(A), pessoa ou empresa que vai realizar o marketing de indicações; nesse relatório mensal vão constar os status atualizados das indicações geradas (ex.: pendentes, em atendimento, convertidas ou canceladas), garantindo total transparência ao processo.' },
    { t: 'clausula', texto: 'CLÁUSULA NONA – DA PROTEÇÃO DE DADOS (LGPD) E CONFIDENCIALIDADE' },
    { t: 'p', texto: '9.1. As partes obrigam-se a cumprir rigorosamente as disposições da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), atuando de boa-fé e com transparência.' },
    { t: 'p', texto: '9.2. No tocante aos papéis na Tratabilidade de Dados:' },
    { t: 'item', texto: 'a) Base Legal e Coleta: O(A) PARCEIRO(A) atua como agente de coleta inicial e obriga-se a avisar expressamente o lead (titular dos dados) sobre o compartilhamento de suas informações para fins de simulação de plano de saúde, obtendo o consentimento prévio e inequívoco deste.' },
    { t: 'item', texto: 'b) Restrição de Finalidade: Fica terminantemente proibido ao(à) PARCEIRO(A) utilizar os contatos e dados pessoais dos leads para qualquer outra finalidade alheia a esta parceria, bem como repassá-los a terceiros não autorizados.' },
    { t: 'p', texto: '9.3. Confidencialidade e Não-Aliciamento: O(A) PARCEIRO(A), pessoas ou empresas que vão realizar o marketing de indicações, compromete-se a manter sigilo absoluto sobre todas as informações estratégicas, listas de clientes, métodos e segredos comerciais da CONTRATANTE, consultor(a) de plano de saúde, e O(A) CONTRATANTE também se compromete a manter sigilo absoluto sobre todas as informações estratégicas, listas de clientes, métodos e segredos comerciais referentes ao(à) PARCEIRO(A); além disso, as duas partes obrigam-se a não realizarem um aliciamento para buscarem uma parceria de trabalho externa de forma plagiada ao projeto que está sendo realizado através desse site/aplicativo, sob pena de rescisão imediata e reparação civil integral por perdas e danos.' },
    { t: 'clausula', texto: 'CLÁUSULA DÉCIMA – DA VIGÊNCIA E RESCISÃO' },
    { t: 'p', texto: '10.1. O presente contrato entra em vigor na data de sua assinatura digital e vigorará por prazo indeterminado.' },
    { t: 'p', texto: '10.2. Qualquer das partes poderá rescindir o instrumento a qualquer tempo, mediante aviso prévio por escrito (e-mail ou aplicativo de mensagem) com antecedência mínima de 5 (cinco) dias, ressalvado o direito aos valores devidos por indicações convertidas até a data final.' },
    { t: 'clausula', texto: 'CLÁUSULA DÉCIMA PRIMEIRA – DA ASSINATURA ELETRÔNICA E VALIDADE JURÍDICA' },
    { t: 'p', texto: '11.1. As partes reconhecem expressamente a validade, eficácia e plena aceitação deste instrumento assinado por meio de assinaturas eletrônicas ou digitais (tais como certificações via plataforma gov.br, chaves criptografadas ou aceites eletrônicos identificáveis), dispensando-se a assinatura física em papel para todos os fins de direito.' },
    { t: 'clausula', texto: 'CLÁUSULA DÉCIMA SEGUNDA – DO FORO E TÍTULO EXECUTIVO EXTRAJUDICIAL' },
    { t: 'p', texto: '12.1. O presente instrumento, assinado pelas partes e instrumentado eletronicamente em conjunto com as assinaturas de 02 (duas) testemunhas abaixo identificadas, constitui Título Executivo Extrajudicial, nos termos do Artigo 784, inciso III, do Código de Processo Civil (CPC), apto à execução judicial imediata em caso de inadimplemento das obrigações líquidas, certas e exigíveis aqui pactuadas.' },
    { t: 'p', texto: `12.2. As partes elegem o foro da Comarca de ${FORO} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia a qualquer outro.` },
    { t: 'local', texto: `Rio de Janeiro - RJ, ${dataExtenso()}.` },
    {
      t: 'assinaturas',
      linhas: [
        { papel: 'Consultor(a) de Plano de Saúde / CONTRATANTE', nome: val(c.nome), doc: `${rotuloDoc(c)}: ${val(c.documento)}` },
        { papel: 'PARCEIRO(A) / Indicador(a), que realizará as indicações dos clientes', nome: val(i.nome), doc: `${rotuloDoc(i)}: ${val(i.documento)}` },
      ],
    },
    { t: 'testemunhas' },
  ]
}

export function blocosConsultor(d: DadosContrato): Bloco[] {
  const c = d.parte
  return [
    { t: 'titulo', texto: 'INSTRUMENTO PARTICULAR DE PARCERIA COMERCIAL E GESTÃO DE LEADS' },
    { t: 'p', texto: `CONTRATANTE: ${GERALINDICA}, doravante denominada CONTRATANTE.` },
    { t: 'p', texto: `CONSULTOR(A): ${val(c.nome)}, inscrito(a) no ${rotuloDoc(c)} sob o nº ${val(c.documento)}, com domicílio/sede em ${val(c.endereco)}, doravante denominado(a) CONSULTOR(A).` },
    { t: 'p', texto: 'As partes acima qualificadas resolvem, de comum acordo, celebrar o presente Contrato de Parceria Comercial, que se regerá mediante as cláusulas e condições seguintes:' },
    { t: 'clausula', texto: 'CLÁUSULA PRIMEIRA – DO OBJETO' },
    { t: 'p', texto: '1.1. O presente contrato tem por objeto a formalização de parceria comercial autônoma, consistindo no direcionamento e repasse de potenciais clientes (leads) captados por meio da rede de parceiros de indicação da CONTRATANTE (via QR Code/link) para atendimento, simulação e fechamento técnico de planos de saúde a cargo exclusivo do(a) CONSULTOR(A).' },
    { t: 'p', texto: '1.2. A CONTRATANTE atua estritamente como a ponte de conexão e gestão entre os parceiros de indicação de base e o(a) CONSULTOR(A).' },
    { t: 'clausula', texto: 'CLÁUSULA SEGUNDA – DA AUSÊNCIA DE VÍNCULO EMPREGATÍCIO E DECLARAÇÃO DE HABILITAÇÃO DO CONSULTOR' },
    { t: 'p', texto: '2.1. O(A) CONSULTOR(A) exercerá suas atividades de forma totalmente autônoma e independente, utilizando seus próprios recursos e estrutura, sem qualquer subordinação hierárquica, habitualidade, exclusividade ou fixação de jornada de trabalho em relação à CONTRATANTE.' },
    { t: 'p', texto: '2.2. Fica expressamente declarado que não há qualquer vínculo empregatício, societário ou de representação obrigatória entre as partes, cabendo ao(à) CONSULTOR(A) arcar com todos os tributos, encargos e despesas da sua atividade profissional.' },
    { t: 'p', texto: '2.3. O(A) consultor(a) apresentará uma declaração e comprovante de que é vinculado(a) a uma corretora de plano de saúde ou a sua habilitação de consultor(a); essas declarações são de inteira responsabilidade do(a) consultor(a) de plano de saúde, que responde sozinho(a) por essas informações.' },
    { t: 'clausula', texto: 'CLÁUSULA TERCEIRA – DOS PAGAMENTOS, DA PRESTAÇÃO DE CONTAS E AUDITORIA' },
    { t: 'p', texto: '3.1. Na hipótese de o atendimento e fechamento do contrato serem realizados por um consultor parceiro, será de inteira e exclusiva responsabilidade do referido consultor parceiro efetuar o pagamento da respectiva participação financeira sobre o lucro da primeira mensalidade ou taxa de adesão diretamente ao(à) PARCEIRO(A) ou à pessoa ou à empresa que realizou o marketing de indicações do cliente que contratou os serviços dos planos de saúde, desobrigando integralmente o site pelo pagamento desta parcela referente ao marketing de indicações de clientes especificada no contrato, tendo em vista que a plataforma tem como papel desenvolver um meio de comunicação entre o consultor de plano de saúde e a empresa ou pessoa que vai realizar o marketing de indicações dos clientes que podem vir a contratar o plano de saúde.' },
    { t: 'p', texto: '3.2. O(A) CONSULTOR(A) concorda em realizar a apresentação dos resultados mensais gerados referentes aos leads que foram indicados através do site, através da demonstração dos valores referentes aos resultados do mês e transparência à CONTRATANTE de todos os valores e resultados alcançados e compartilhados com as pessoas ou empresas que indicaram os clientes para o(a) consultor(a), demonstrando assim os valores referentes a essas conversões gerados por meio dos leads indicados. Podendo assim ser gerada pelo(a) consultor(a) uma planilha no Excel ou outro aplicativo ou até mesmo um CRM para a demonstração desses resultados, com a única e exclusiva intenção de dar transparência aos valores ganhos através da parceria de trabalho; porém, o(a) consultor(a) deverá respeitar a LGPD, Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), sem transmitir nenhum dado pessoal dos clientes, sendo apenas uma tabela demonstrando somente o resultado das vendas, sem nenhuma informação de nenhum cliente. Exemplo: Cliente 1, valor da venda do plano de saúde 1000 (mil reais); após a dedução de imposto sobraram 725 reais; foi realizado o pagamento de 362,5 reais para a pessoa ou empresa que realizou o marketing de indicações e, após isso, sobraram 362,5 mais 1000 reais de bonificação; após a dedução de imposto sobraram 725 reais para serem calculados juntamente com o(a) consultor(a) do plano de saúde e com o site que realizou a ponte entre as pessoas e as empresas que indicaram os clientes para o(a) consultor(a) de plano de saúde, sendo realizado o pagamento do lucro desse valor de 725 + 362,5 = 1087,5 da seguinte forma: pagando 50% do valor do lucro obtido ao site, sendo um total de 543,75 para o(a) consultor(a) e 543,75 para o site, e esses valores de pagamento são mediante o serviço prestado de captação de pessoas e empresas que vão realizar o marketing de indicações para o(a) consultor(a) de plano de saúde. O consultor concorda e compreende que o site terá o direito de realizar uma auditoria somente dos valores compartilhados com as pessoas e empresas que realizaram as indicações.' },
    { t: 'p', texto: '3.3. Se houver atraso no pagamento incidirão juros de 1% por dia de atraso no pagamento, e entende-se que o 5º dia do mês seguinte é o prazo limite para realizar o pagamento.' },
    { t: 'p', texto: '3.4. Fica acordado entre as partes a confidencialidade e o não-aliciamento das pessoas ou empresas que vão realizar as indicações (compreende-se que o(a) consultor(a) de plano de saúde não pode pegar a rede de indicadores para receber indicações por fora do site).' },
    { t: 'p', texto: '3.5. As partes concordam que os leads captados através do trabalho desenvolvido permanecerão atrelados a esse acordo por 10 anos para os casos de mudanças de plano de saúde e, se em algum momento trocarem de plano de saúde, o(a) consultor(a) vai realizar o pagamento dos valores referentes aos serviços prestados referentes a essa venda do plano de saúde, que foi desenvolvida através do marketing de indicação das pessoas ou empresas que indicaram o cliente e do site que gerou a conexão entre as pessoas ou empresas que realizaram o marketing de indicação e o(a) consultor(a) de plano de saúde, no período de 10 anos.' },
    { t: 'clausula', texto: 'CLÁUSULA QUARTA – DA REMUNERAÇÃO E PARTILHA DE LUCROS' },
    { t: 'p', texto: '4.1. Após o(a) CONSULTOR(A) efetuar o pagamento devido ao parceiro que realizou o marketing de indicação (pessoas ou empresas que realizaram o marketing de indicações dos clientes que realizaram o contrato com o plano de saúde), o lucro líquido remanescente obtido pelo(a) CONSULTOR(A) será utilizado para pagar a CONTRATANTE (o site).' },
    { t: 'p', texto: '4.2. O pagamento dos valores a serem pagos incidirá de forma ampla sobre:' },
    { t: 'item', texto: 'a) O lucro líquido obtido na primeira parcela da mensalidade ou taxa de adesão do contrato fechado.' },
    { t: 'item', texto: 'b) O lucro líquido referente a bonificações, comissões de recorrência referentes aos ganhos do fechamento do contrato com o cliente ou pagamentos subsequentes recebidos pelo(a) CONSULTOR(A) decorrentes daqueles clientes indicados.' },
    { t: 'p', texto: '4.3. O pagamento será realizado e acordado com um lucro líquido aplicável à CONTRATANTE que será de 50% sobre o montante remanescente após a dedução do pagamento do indicador (pessoas e empresas que indicaram os clientes) e dos tributos aplicáveis.' },
    { t: 'p', texto: '4.4. O pagamento referente à CONTRATANTE (o site) será referente aos serviços prestados no mês anterior e calculado através dos valores do lucro líquido apurado no mês anterior; esse pagamento deverá ser realizado obrigatoriamente até o dia 5 (cinco) do mês subsequente, garantindo o prazo hábil para contabilidade, conferência e transferência dos valores. A estratégia de realizar o pagamento em cima do lucro líquido tem como propósito desenvolver um pagamento justo para o(a) consultor(a), ao invés de cobrar um valor fixo pela prestação de serviço, que em mês com poucas vendas não seria possível pagar ou deixaria o consultor no prejuízo para cobrir o valor combinado como fixo da prestação de serviços, serviço esse que a empresa estimaria em torno de 15 mil reais por mês, podendo haver reajustes conforme a legislação brasileira permite.' },
    { t: 'clausula', texto: 'CLÁUSULA QUINTA – DOS ESTORNOS E CANCELAMENTOS' },
    { t: 'p', texto: '5.1. Caso ocorra distrato, cancelamento, desistência do cliente ou estorno de comissão/bonificação por parte da operadora de plano de saúde, a CONTRATANTE restituirá o valor proporcional correspondente que lhe tenha sido pago referente à prestação de serviços para o consultor de plano de saúde.' },
    { t: 'p', texto: '5.2. A devolução do valor estornado ocorrerá no prazo máximo de 5 (cinco) dias contados a partir da efetiva ciência da CONTRATANTE. A comunicação será realizada através do chat do site. Caso a comunicação seja enviada por aplicativos de mensagens (como WhatsApp e e-mail) e ainda não tenha sido visualizada ou confirmada pela CONTRATANTE, constituirá obrigação da outra parte efetuar contato telefônico direto para assegurar a ciência inequívoca e iniciar a contagem do referido prazo.' },
    { t: 'p', texto: '5.3. Fica facultado à CONTRATANTE realizar a compensação dos valores estornados em repasses ou créditos futuros, caso assim prefira.' },
    { t: 'clausula', texto: 'CLÁUSULA SEXTA – DA VIGÊNCIA E RESCISÃO' },
    { t: 'p', texto: '6.1. O presente contrato entra em vigor na data de sua assinatura e vigorará por prazo indeterminado.' },
    { t: 'p', texto: '6.2. O instrumento poderá ser rescindido por qualquer uma das partes, a qualquer tempo, mediante aviso prévio formalizado por escrito, admitindo-se expressamente a comunicação por meio das comunicações informadas no site ou aplicativo de mensagens instantâneas (como WhatsApp) ou e-mail, com antecedência mínima de 5 (cinco) dias, ressalvado o direito aos acertos financeiros de indicações e vendas já concluídas até a data do encerramento. Porém, a responsabilidade do site referente aos estornos das bonificações permanece pelo tempo de carência da bonificação, e também a partilha das vendas realizadas através dos leads que foram indicados continua valendo por 90 dias após a rescisão do contrato, pois entende-se que às vezes leva um tempo para que as pessoas se decidam até realizar o contrato do plano de saúde; sendo assim, um lead que foi indicado 1 dia antes do encerramento do contrato pode, alguns dias depois, realizar o contrato, e as partes concordam e entendem que essa pessoa veio através da indicação das pessoas e empresas que estão conectadas juntamente com o site através das indicações, e concordam que, no prazo de até 90 dias, é justo que a divisão dos lucros seja compartilhada da mesma forma como estava sendo compartilhada antes da rescisão do contrato.' },
    { t: 'clausula', texto: 'CLÁUSULA SÉTIMA – DO FORO' },
    { t: 'p', texto: `7.1. As partes elegem o foro da Comarca de ${FORO} para dirimir quaisquer litígios oriundos deste contrato, com renúncia expressa a qualquer outro.` },
    { t: 'p', texto: 'E, por estarem justos e contratados, assinam o presente instrumento digital ou em duas vias de igual teor.' },
    { t: 'local', texto: `Rio de Janeiro - RJ, ${dataExtenso()}.` },
    {
      t: 'assinaturas',
      linhas: [
        { papel: 'CONTRATANTE', nome: 'GERALINDICA', doc: 'CNPJ: 68.110.529/0001-00' },
        { papel: 'CONSULTOR(A)', nome: val(c.nome), doc: `${rotuloDoc(c)}: ${val(c.documento)}` },
      ],
    },
  ]
}

export const nomeArquivoContrato = (d: DadosContrato) =>
  `contrato-${d.tipo === 'indicador' ? 'indicador' : 'consultor'}-${(d.parte.nome || 'geralindica').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`

/** Gera o PDF do contrato no navegador. */
export async function gerarPdfContrato(d: DadosContrato): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 20
  const W = 210 - 2 * M
  const FIM = 297 - 18
  let y = 22
  const quebra = (h: number) => {
    if (y + h > FIM) {
      doc.addPage()
      y = 20
    }
  }
  const paragrafo = (texto: string, { negrito = false, tam = 10, recuo = 0, depois = 2.2, alinhar = 'justify' as 'justify' | 'center' | 'left' } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(tam)
    const linhas: string[] = doc.splitTextToSize(texto, W - recuo)
    const alt = tam * 0.43
    linhas.forEach((l, i) => {
      quebra(alt)
      if (alinhar === 'center') doc.text(l, 105, y, { align: 'center' })
      else if (alinhar === 'justify' && i < linhas.length - 1) doc.text(l, M + recuo, y, { align: 'justify', maxWidth: W - recuo })
      else doc.text(l, M + recuo, y)
      y += alt
    })
    y += depois
  }

  const blocos = d.tipo === 'indicador' ? blocosIndicador(d) : blocosConsultor(d)
  for (const b of blocos) {
    if (b.t === 'titulo') paragrafo(b.texto, { negrito: true, tam: 13, alinhar: 'center', depois: 6 })
    else if (b.t === 'secao') paragrafo(b.texto, { negrito: true, tam: 10.5, depois: 1.2, alinhar: 'left' })
    else if (b.t === 'clausula') {
      y += 2
      quebra(14)
      paragrafo(b.texto, { negrito: true, tam: 10.5, depois: 1.6, alinhar: 'left' })
    } else if (b.t === 'p') paragrafo(b.texto)
    else if (b.t === 'item') paragrafo(b.texto, { recuo: 6 })
    else if (b.t === 'local') {
      y += 4
      paragrafo(b.texto, { alinhar: 'left', depois: 8 })
    } else if (b.t === 'assinaturas') {
      for (const a of b.linhas) {
        quebra(26)
        y += 8
        doc.setLineWidth(0.2)
        doc.line(M, y, M + 110, y)
        y += 4.5
        paragrafo(a.nome, { negrito: true, alinhar: 'left', depois: 0.6 })
        paragrafo(`${a.papel} · ${a.doc}`, { tam: 9, alinhar: 'left', depois: 0.6 })
        paragrafo('Assinatura eletrônica Gov.br', { tam: 8.5, alinhar: 'left', depois: 2 })
      }
    } else if (b.t === 'testemunhas') {
      y += 4
      paragrafo('TESTEMUNHAS:', { negrito: true, alinhar: 'left', depois: 1 })
      d.testemunhas.slice(0, 2).forEach((t, i) => {
        quebra(30)
        paragrafo(`Testemunha ${i + 1}:`, { negrito: true, alinhar: 'left', depois: 0.6 })
        paragrafo(`Nome: ${val(t.nome)}`, { alinhar: 'left', depois: 0.4 })
        paragrafo(`CPF: ${val(t.cpf)}`, { alinhar: 'left', depois: 0.4 })
        paragrafo(`E-mail: ${val(t.email)}`, { alinhar: 'left', depois: 0.4 })
        paragrafo('Assinatura eletrônica: ______________________________', { alinhar: 'left', depois: 3 })
      })
    }
  }

  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(120)
    doc.text(`Geralindica · contrato ${d.tipo === 'indicador' ? 'do indicador' : 'do consultor'} · versão ${VERSAO_TEXTO} · nº ${d.id.slice(0, 8)} · gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, 297 - 10)
    doc.text(`Página ${p} de ${total}`, 210 - M, 297 - 10, { align: 'right' })
    doc.setTextColor(0)
  }
  return doc.output('blob')
}

export async function baixarPdfContrato(d: DadosContrato) {
  const blob = await gerarPdfContrato(d)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoContrato(d)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Campos que faltam no cadastro para o PDF sair completo. */
export function camposFaltando(p: ParteContrato, comRg = true) {
  const f: string[] = []
  if (!p.nome?.trim()) f.push('nome')
  if (!p.documento?.trim()) f.push(p.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF')
  if (comRg && p.tipo_pessoa !== 'PJ' && !p.rg?.trim()) f.push('RG')
  if (!p.endereco?.trim()) f.push('endereço')
  if (!p.telefone?.trim()) f.push('telefone')
  return f
}

/** Modelo sem dados (página de termos). */
export function modeloVazio(tipo: 'indicador' | 'consultor'): DadosContrato {
  const p: ParteContrato = { nome: '', tipo_pessoa: 'PF', documento: null, rg: null, endereco: null, email: null, telefone: null }
  return { id: 'modelo00', tipo, etapa: 'parte', versao: VERSAO_TEXTO, arquivo: null, observacao: null, created_at: new Date().toISOString(), parte_assinou_em: null, consultor_assinou_em: null, vigente_em: null, parte: p, consultor: p, testemunhas: [{ nome: null, cpf: null, email: null }, { nome: null, cpf: null, email: null }] }
}
