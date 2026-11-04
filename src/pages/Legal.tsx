import { Link } from 'react-router-dom'

const TERMOS = [
  ['O que é a Geralindica', 'A Geralindica é uma plataforma de agenciamento de leads e marketing que conecta indicadores (parceiros que divulgam QR Codes) a consultores habilitados que atendem clientes interessados em planos de saúde.'],
  ['Natureza da relação', 'Indicadores e consultores atuam com autonomia, sem vínculo empregatício, subordinação ou exclusividade. A venda e o atendimento são feitos pelo consultor, corretor habilitado junto à SUSEP.'],
  ['Comissões', 'Do valor da adesão é descontado o imposto do consultor, que recebe do cliente. Do líquido, 50% são do indicador, pagos pelo consultor por Pix depois da entrevista de saúde aprovada. A parte do consultor, somada à bonificação que a operadora paga a ele (também sem o imposto), é dividida entre o consultor e a Geralindica. Os percentuais ficam no contrato e podem mudar por aditivo.'],
  ['Pagamentos', 'A Geralindica não recebe, não guarda e não repassa dinheiro. O cliente paga diretamente ao consultor, que faz os repasses por Pix ao indicador e à Geralindica. A plataforma apenas registra as vendas informadas pelo consultor.'],
  ['Entrevista de saúde e devolução', 'O consultor mantém o pagamento da adesão até a entrevista de saúde. Se aprovado (Verdinho), registra a venda e faz os repasses. Se reprovado, devolve 100% do valor ao cliente e não há comissão.'],
  ['Temperatura', 'Cada consultor tem uma temperatura pública, calculada a partir das vendas registradas, das avaliações dos indicadores e das vendas recentes. Ela serve para os indicadores escolherem com quem trabalhar.'],
  ['Portabilidade', 'O indicador pode trocar de consultor a qualquer momento, desde que o novo consultor tenha vaga na carteira (limite de até 30 indicadores). Leads em andamento permanecem com o consultor anterior.'],
  ['Assinatura', 'Os contratos de indicadores e consultores são assinados eletronicamente com a conta Gov.br.'],
]

const PRIVACIDADE = [
  ['Dados que tratamos', 'Nome, CPF ou CNPJ, telefone e e-mail dos usuários; dos clientes, os dados necessários para cotação e contratação do plano, incluindo dados de saúde fornecidos à Administradora.'],
  ['Quem vê o quê', 'O indicador vê apenas o primeiro nome do cliente, a data, o status e o valor estimado a receber. CPF, telefone, endereço e dados de saúde ficam sempre mascarados para ele. O consultor vê os dados dos próprios clientes para fazer o atendimento.'],
  ['Segurança', 'As regras de acesso são aplicadas no banco de dados (Row Level Security): cada usuário só consegue ler o que o seu papel permite, mesmo fora da interface.'],
  ['Seus direitos (LGPD)', 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail privacidade@geralindica.com.br.'],
]

export function Legal({ tipo }: { tipo: 'termos' | 'privacidade' }) {
  const itens = tipo === 'termos' ? TERMOS : PRIVACIDADE
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-24 pt-12 sm:px-7">
      <h1 className="m-0 text-[34px] font-extrabold tracking-[-0.04em]">{tipo === 'termos' ? 'Termos de uso' : 'Política de privacidade'}</h1>
      <p className="m-0 rounded-[14px] bg-ambar-bg px-4 py-3 text-[13px] font-semibold text-ambar-fg">
        Rascunho para validação jurídica (enquadramento como agenciamento de leads, SUSEP/ANS e LGPD). Não publicar sem revisão de um advogado.
      </p>
      {itens.map(([t, x]) => (
        <section key={t} className="flex flex-col gap-2">
          <h2 className="m-0 text-[20px] font-extrabold">{t}</h2>
          <p className="m-0 text-[16px] leading-[1.65] text-ink-800">{x}</p>
        </section>
      ))}
      <Link to="/" className="font-bold text-verde-700">
        ← Voltar para o início
      </Link>
    </main>
  )
}
