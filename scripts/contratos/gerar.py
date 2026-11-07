"""Gera os PDFs dos contratos (public/contratos/*.pdf) que a pessoa baixa, assina no assinador.iti.br e envia pelo site.

Rodar: python scripts/contratos/gerar.py  (precisa de `pip install reportlab`)
Mudou o texto? Suba VERSAO e rode de novo. Os contratos já assinados continuam valendo na versão em que foram assinados.
"""
from pathlib import Path

from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

VERSAO = '1 — 07/11/2026'
# Dados da empresa: preencher quando o CNPJ existir.
CONTRATANTE = (
    '<b>GERALINDICA</b>, plataforma de agenciamento de leads e marketing disponível em geralindica.com.br, '
    'razão social e CNPJ: ______________________________, '
    'doravante <b>CONTRATANTE</b>'
)
SAIDA = Path(__file__).resolve().parents[2] / 'public' / 'contratos'

base = ParagraphStyle('base', fontName='Helvetica', fontSize=10, leading=14.5, alignment=TA_JUSTIFY, spaceAfter=6)
titulo = ParagraphStyle('titulo', parent=base, fontName='Helvetica-Bold', fontSize=15, leading=19, alignment=1, spaceAfter=4)
sub = ParagraphStyle('sub', parent=base, fontSize=9, alignment=1, textColor='#5B6B7F', spaceAfter=14)
clausula = ParagraphStyle('clausula', parent=base, fontName='Helvetica-Bold', fontSize=10.5, spaceBefore=8, spaceAfter=4)

CONTRATADO = (
    'a pessoa física ou jurídica identificada pela assinatura eletrônica Gov.br aposta neste documento e pelo cadastro '
    'feito na plataforma (nome, CPF ou CNPJ, e-mail e telefone), doravante <b>CONTRATADO(A)</b>'
)

FINAL = [
    ('Assinatura eletrônica', [
        'Este contrato é assinado eletronicamente com a conta Gov.br do(a) CONTRATADO(A), nos termos da Lei 14.063/2020, '
        'e enviado pela plataforma. Ele passa a valer quando a CONTRATANTE confere o documento assinado no painel administrativo.',
        'Fica eleito o foro da comarca da sede da CONTRATANTE para resolver questões deste contrato.',
    ]),
]

INDICADOR = {
    'arquivo': 'contrato-indicador.pdf',
    'titulo': 'CONTRATO DE INDICAÇÃO COMERCIAL',
    'objeto': 'prestação autônoma de serviços de divulgação e indicação (agenciamento de leads e marketing)',
    'clausulas': [
        ('Objeto', [
            'O(A) CONTRATADO(A) divulga, com os QR Codes e links gerados pela plataforma, a possibilidade de contratar planos de '
            'saúde com consultores parceiros. Quem se interessa é levado ao WhatsApp do consultor vinculado ao(à) CONTRATADO(A).',
            'O(A) CONTRATADO(A) não vende, não negocia, não recebe pagamentos de clientes e não dá orientação técnica sobre planos. '
            'O atendimento e a venda são feitos exclusivamente pelo consultor, corretor habilitado.',
        ]),
        ('Autonomia', [
            'A relação é de prestação de serviços autônoma, sem vínculo empregatício, subordinação, horário, metas obrigatórias ou exclusividade.',
        ]),
        ('Remuneração', [
            'Para cada adesão originada por indicação do(a) CONTRATADO(A) e <b>aprovada na entrevista de saúde</b>, o(a) CONTRATADO(A) '
            'recebe 50% (cinquenta por cento) do valor líquido da adesão, entendido como o valor pago pelo cliente menos o imposto do consultor.',
            'O pagamento é feito <b>pelo consultor, por Pix</b>, depois da aprovação. A CONTRATANTE não recebe, não guarda e não repassa '
            'dinheiro: a plataforma apenas registra as vendas informadas pelo consultor e mostra o valor estimado a receber.',
            'Adesão reprovada na entrevista de saúde é devolvida ao cliente e não gera comissão.',
            'O percentual pode ser alterado por aditivo ou aviso na plataforma com 30 (trinta) dias de antecedência, sem efeito sobre vendas já registradas.',
        ]),
        ('Obrigações do(a) CONTRATADO(A)', [
            'a) divulgar de forma verdadeira, sem prometer preço, cobertura, carência ou aprovação; '
            'b) não usar marcas de operadoras ou administradoras sem autorização; '
            'c) não enviar mensagens em massa sem consentimento (spam); '
            'd) manter seus dados de cadastro atualizados; '
            'e) cuidar das próprias obrigações fiscais sobre o que receber.',
        ]),
        ('Obrigações da CONTRATANTE', [
            'Manter a plataforma, os QR Codes e o registro das vendas disponíveis, e vincular o(a) CONTRATADO(A) a um consultor com vaga na carteira.',
        ]),
        ('Consultor e portabilidade', [
            'O(A) CONTRATADO(A) escolhe o consultor na vitrine e pode trocar a qualquer momento, se o novo consultor tiver vaga. '
            'Os atendimentos em andamento continuam com o consultor anterior.',
        ]),
        ('Dados pessoais (LGPD)', [
            'O(A) CONTRATADO(A) vê apenas o primeiro nome do cliente, a data, o status da venda e o valor estimado a receber. '
            'Compromete-se a manter sigilo sobre qualquer dado de cliente a que tenha acesso.',
        ]),
        ('Vigência e rescisão', [
            'O contrato vale por prazo indeterminado e pode ser encerrado por qualquer das partes a qualquer momento, com aviso pela plataforma ou por e-mail. '
            'As comissões de vendas aprovadas antes do encerramento continuam devidas pelo consultor.',
        ]),
    ],
}

CONSULTOR = {
    'arquivo': 'contrato-consultor.pdf',
    'titulo': 'CONTRATO DE PARCERIA DE CORRETAGEM',
    'objeto': 'parceria comercial',
    'clausulas': [
        ('Objeto', [
            'A CONTRATANTE oferece ao(à) CONTRATADO(A) a plataforma Geralindica: perfil na vitrine de consultores, carteira de indicadores, '
            'QR Codes que levam clientes ao WhatsApp do(a) CONTRATADO(A) e CRM de leads. O(A) CONTRATADO(A) atende os clientes, faz a venda e recebe o pagamento.',
        ]),
        ('Declarações do(a) CONTRATADO(A)', [
            'O(A) CONTRATADO(A) declara ter habilitação regular para a corretagem de planos de saúde e responde, de forma autônoma, '
            'pelo atendimento, pela orientação ao cliente e pelo cumprimento das normas da ANS e da SUSEP. A relação com administradoras e operadoras é dele(a).',
        ]),
        ('Recebimento e entrevista de saúde', [
            'O(A) CONTRATADO(A) recebe o pagamento da adesão diretamente do cliente e o mantém até a entrevista de saúde. '
            'Se aprovado, segue com os repasses abaixo; se reprovado, devolve 100% (cem por cento) do valor ao cliente. '
            'A CONTRATANTE não recebe, não guarda e não repassa dinheiro.',
        ]),
        ('Registro das vendas', [
            'O(A) CONTRATADO(A) registra na plataforma toda venda originada por indicador da sua carteira, com o valor real, o status '
            '(aguardando entrevista, aprovada ou reprovada e devolvida) e o percentual de bonificação recebido, atualizando o registro a cada mudança. '
            'Os registros podem ser conferidos pela CONTRATANTE.',
        ]),
        ('Divisão dos valores', [
            'a) Do valor da adesão desconta-se o imposto do(a) CONTRATADO(A), conforme o regime informado na plataforma (pessoa física ou jurídica e faixa), chegando ao valor líquido; '
            'b) 50% (cinquenta por cento) do líquido são do indicador, pagos pelo(a) CONTRATADO(A) por Pix; '
            'c) a parte restante do líquido, somada à bonificação paga pela operadora ou administradora depois da aprovação (também sem o imposto), forma o valor a dividir; '
            'd) desse valor, 50% (cinquenta por cento) ficam com o(a) CONTRATADO(A) e 50% (cinquenta por cento) são pagos à CONTRATANTE por Pix.',
            'Os Pix ao indicador e à CONTRATANTE são feitos em até 5 (cinco) dias úteis depois de o(a) CONTRATADO(A) receber cada valor. '
            'Os percentuais valem conforme a configuração da plataforma na data de cada venda e só mudam por aditivo ou aviso com 30 (trinta) dias de antecedência.',
        ]),
        ('Carteira e conduta', [
            'A carteira tem até 30 (trinta) indicadores, que podem trocar de consultor livremente. O(A) CONTRATADO(A) não pode desviar clientes '
            'ou indicadores da plataforma para evitar os repasses. A temperatura e as avaliações do perfil são públicas.',
        ]),
        ('Dados pessoais (LGPD)', [
            'O(A) CONTRATADO(A) trata os dados dos próprios clientes, inclusive dados de saúde, como controlador, com sigilo e só para o atendimento, '
            'e não compartilha dados sensíveis com indicadores.',
        ]),
        ('Descumprimento', [
            'Registro falso, falta de repasse ou desvio de clientes permitem à CONTRATANTE suspender o perfil, retirá-lo da vitrine e cobrar os valores devidos.',
        ]),
        ('Vigência e rescisão', [
            'O contrato vale por prazo indeterminado e pode ser encerrado por qualquer das partes a qualquer momento, com aviso pela plataforma ou por e-mail. '
            'Os repasses de vendas feitas antes do encerramento continuam devidos.',
        ]),
    ],
}


def gerar(c: dict) -> None:
    doc = SimpleDocTemplate(str(SAIDA / c['arquivo']), pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                            topMargin=2 * cm, bottomMargin=2 * cm, title=c['titulo'].title(), author='Geralindica')
    h = [Paragraph(c['titulo'], titulo), Paragraph(f'Versão {VERSAO}', sub)]
    h.append(Paragraph(f'Pelo presente instrumento, de um lado {CONTRATANTE}, e de outro {CONTRATADO}, '
                       f'celebram este contrato de {c["objeto"]}, nas condições abaixo.', base))
    for n, (nome, paragrafos) in enumerate(c['clausulas'] + FINAL, start=1):
        h.append(Paragraph(f'Cláusula {n}ª — {nome}', clausula))
        h += [Paragraph(p, base) for p in paragrafos]
    h += [Spacer(1, 18), Paragraph('Assinado eletronicamente pelo Gov.br (assinador.iti.br).', sub)]
    doc.build(h)


if __name__ == '__main__':
    SAIDA.mkdir(parents=True, exist_ok=True)
    for c in (INDICADOR, CONSULTOR):
        gerar(c)
        print('ok', SAIDA / c['arquivo'])
