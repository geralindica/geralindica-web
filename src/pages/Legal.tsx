import { Link } from 'react-router-dom'

const TERMOS = [
  ['O que é a Geralindica', 'A Geralindica é uma plataforma de agenciamento de leads e marketing que conecta indicadores (parceiros que divulgam QR Codes) a consultores habilitados que atendem clientes interessados em planos de saúde. A Geralindica não tem sede física: atua só pelo site.'],
  ['Contratos', 'O indicador assina um contrato de parceria com o consultor da carteira dele (o consultor é o contratante), com duas testemunhas. O consultor assina um contrato de parceria com a Geralindica. Os modelos estão abaixo; no painel, cada contrato sai preenchido com os dados do cadastro.'],
  ['Natureza da relação', 'Indicadores e consultores atuam com autonomia, sem vínculo empregatício, subordinação ou exclusividade. A venda e o atendimento são feitos pelo consultor, habilitado ou vinculado a uma corretora.'],
  ['Remuneração pelo marketing', 'O indicador é remunerado pelo serviço de marketing de indicação: o resultado que o consultor tem com cada cliente indicado, já sem os impostos, é dividido meio a meio entre os dois, e o consultor paga em até 5 dias úteis depois de receber. A parte do consultor, somada à bonificação da operadora (também sem imposto), é dividida meio a meio entre o consultor e a Geralindica; comissões recorrentes e bonificações seguintes do mesmo cliente também. A parte da Geralindica de cada mês vence no dia 5 do mês seguinte, com juros de 1% ao dia de atraso.'],
  ['Sem prazo e troca de plano', 'A indicação não tem prazo de validade: quando o cliente fecha com o consultor, o indicador recebe. Se o cliente trocar de plano em até 10 anos, o consultor paga de novo o indicador e a Geralindica.'],
  ['Reprovação', 'O consultor fica com o pagamento do cliente até a entrevista de saúde. Se o cliente for reprovado, o consultor devolve 100% a ele e ninguém recebe. Só depois da aprovação (Verdinho) o indicador e a Geralindica recebem.'],
  ['Pagamentos', 'A Geralindica não recebe nem repassa dinheiro de clientes. O cliente paga diretamente ao consultor, que faz os repasses ao indicador e à Geralindica. A plataforma registra as vendas informadas pelo consultor e mostra os valores.'],
  ['Chat interno', 'Indicador e consultor conversam pelo chat do site, monitorado por robô. Só vale falar de ganhos e dados de conta corrente. É proibido passar telefone, e-mail, redes sociais, links, profissão ou como as indicações são feitas. Quem desrespeitar tem o contrato cancelado e sai do site, junto com a outra parte.'],
  ['Temperatura', 'Cada consultor tem uma temperatura pública, calculada a partir das vendas registradas, das avaliações dos indicadores e das vendas recentes.'],
  ['Portabilidade', 'O indicador pode trocar de consultor se o novo tiver vaga (até 30 indicadores). Ao trocar, assina um contrato novo com o novo consultor. Leads em andamento continuam com o consultor anterior.'],
  ['Assinatura', 'Os contratos são assinados eletronicamente com a conta Gov.br (assinador.iti.br), na ordem: a parte, o consultor (no contrato do indicador) e, por fim, a Geralindica, que confere e colhe as testemunhas. Foro: Rio de Janeiro/RJ.'],
]

const PRIVACIDADE = [
  ['Dados que tratamos', 'Nome, CPF ou CNPJ, RG, endereço, telefone e e-mail dos usuários (vão nos contratos); mensagens do chat interno; dos clientes, os dados necessários para a cotação, compartilhados com o consultor com o consentimento dado ao escanear o QR Code.'],
  ['Quem vê o quê', 'O indicador vê apenas o primeiro nome do cliente, a data, o status e o valor estimado a receber. O consultor vê os dados dos próprios clientes para fazer o atendimento. Indicador e consultor de um mesmo contrato veem os dados de qualificação um do outro, porque eles saem no contrato.'],
  ['Chat monitorado', 'As mensagens do chat entre indicador e consultor passam por um robô, que barra telefone, e-mail, redes sociais e outros dados proibidos pelo contrato. A Geralindica pode ler as conversas para fiscalizar as regras.'],
  ['Segurança', 'As regras de acesso são aplicadas no banco de dados (Row Level Security): cada usuário só consegue ler o que o seu papel permite, mesmo fora da interface.'],
  ['Seus direitos (LGPD)', 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo WhatsApp oficial da Geralindica, (21) 98466-5584.'],
]

function BaixarModelo({ tipo, rotulo }: { tipo: 'indicador' | 'consultor'; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const m = await import('@/lib/contratos')
        await m.baixarPdfContrato(m.modeloVazio(tipo))
      }}
      className="cursor-pointer rounded-[12px] border border-ink-200 bg-white px-4 py-2.5 text-[14px] font-bold hover:border-ink-950"
    >
      {rotulo}
    </button>
  )
}

export function Legal({ tipo }: { tipo: 'termos' | 'privacidade' }) {
  const itens = tipo === 'termos' ? TERMOS : PRIVACIDADE
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 pb-24 pt-12 sm:px-7">
      <h1 className="m-0 text-[34px] font-extrabold tracking-[-0.04em]">{tipo === 'termos' ? 'Termos de uso' : 'Política de privacidade'}</h1>
      <p className="m-0 rounded-[14px] bg-ambar-bg px-4 py-3 text-[13px] font-semibold text-ambar-fg">
        Versão de 08/11/2026, com os contratos do Luis, em revisão jurídica. Pode mudar; avisaremos na plataforma.
      </p>
      {itens.map(([t, x]) => (
        <section key={t} className="flex flex-col gap-2">
          <h2 className="m-0 text-[20px] font-extrabold">{t}</h2>
          <p className="m-0 text-[16px] leading-[1.65] text-ink-800">{x}</p>
        </section>
      ))}
      {tipo === 'termos' && (
        <div className="flex flex-wrap gap-2">
          <BaixarModelo tipo="indicador" rotulo="Modelo do contrato do indicador (PDF)" />
          <BaixarModelo tipo="consultor" rotulo="Modelo do contrato do consultor (PDF)" />
        </div>
      )}
      <Link to="/" className="font-bold text-verde-700">
        ← Voltar para o início
      </Link>
    </main>
  )
}
