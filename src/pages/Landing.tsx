import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Accordion from '@radix-ui/react-accordion'
import { Apple, Flower2, Headset, MessageCircle, Minus, Plus, QrCode, ShieldCheck, ShieldPlus, ShieldUser, Smile, Store, Thermometer } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { VerdinhoBadge } from '@/components/ui/badges'
import { Chip, Eyebrow } from '@/components/ui/form'
import { CheckCircleFilled } from '@/components/icons'
import { faqs } from '@/data/conteudo'
import { brl } from '@/lib/utils'
import { useConfig } from '@/data/queries'
import { calcularSplit, pct } from '@/lib/negocio'

const h2 = 'm-0 text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[44px]'

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-14 px-7 pb-[72px] pt-16">
      <div className="flex flex-col gap-7">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-ink-200 bg-white py-1.5 pl-2 pr-[14px] text-[13px] font-bold">
          <span className="rounded-full bg-verde-600 px-2 py-0.5 text-[11px] text-white">NOVO</span>
          Indicações de plano de saúde com comissão rastreada
        </span>
        <h1 className="m-0 text-balance text-[clamp(44px,6vw,72px)] font-extrabold leading-none tracking-[-0.05em]">
          Indique planos de saúde. Receba <span className="text-verde-600">no verdinho.</span>
        </h1>
        <p className="m-0 max-w-[520px] text-pretty text-[19px] leading-[1.55] text-ink-600">
          Espalhe seu QR Code no carro, na loja ou no Instagram. O cliente chama o seu consultor no WhatsApp, ele faz todo o atendimento e, com a adesão aprovada, manda a sua parte por Pix.
        </p>
        <div className="grid max-w-[560px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <Link
            to="/cadastro?papel=indicador"
            className="flex flex-col gap-1.5 rounded-[18px] bg-verde-600 px-5 py-[18px] text-white shadow-verde transition-colors hover:bg-verde-700"
          >
            <QrCode size={26} />
            <span className="text-[18px] font-extrabold">Quero indicar e ganhar</span>
            <span className="text-[13px] opacity-85">Motoristas, comércios e criadores</span>
          </Link>
          <Link
            to="/cadastro?papel=consultor"
            className="flex flex-col gap-1.5 rounded-[18px] border border-ink-200 bg-white px-5 py-[18px] transition-colors hover:border-ink-950"
          >
            <Headset size={26} />
            <span className="text-[18px] font-extrabold">Sou consultor</span>
            <span className="text-[13px] text-ink-600">Receba clientes de indicadores</span>
          </Link>
        </div>
      </div>
      <div className="relative">
        <img
          src="https://images.pexels.com/photos/24981306/pexels-photo-24981306.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="Motorista de aplicativo sorrindo"
          className="block aspect-[4/5] w-full rounded-[28px] bg-ink-200 object-cover"
        />
        <div className="absolute bottom-10 left-[-12px] flex min-w-[230px] flex-col gap-2 rounded-[18px] bg-white px-[18px] py-4 shadow-float sm:left-[-20px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink-600">Comissão · Ana</span>
            <VerdinhoBadge />
          </div>
          <div className="text-[30px] font-extrabold tracking-[-0.03em]">+ R$ 362,50</div>
        </div>
        <div className="absolute right-[-8px] top-9 flex items-center gap-[10px] rounded-2xl bg-ink-950 px-[14px] py-3 text-white shadow-dark sm:right-[-12px]">
          <MessageCircle size={22} className="text-verde-300" />
          <div className="flex flex-col">
            <span className="text-[12px] opacity-70">WhatsApp · canal 01</span>
            <span className="text-[14px] font-bold">Cliente chegou com o seu código</span>
          </div>
        </div>
      </div>
    </section>
  )
}

const passos = [
  { n: '01', icon: <QrCode size={28} />, iconCls: 'bg-ink-950 text-white', title: 'Espalhe seu QR Code', text: 'Capa de encosto do banco, cartão no balcão, banner ou post. Cada canal tem um código próprio, então você sabe de onde veio cada cliente.' },
  { n: '02', icon: <MessageCircle size={28} />, iconCls: 'bg-azul-solid text-white', title: 'O consultor atende no WhatsApp', text: 'O cliente escaneia e cai direto no WhatsApp do seu consultor, com o seu código na mensagem. O consultor cota, negocia e fecha.' },
]

function ComoFunciona() {
  return (
    <section id="como-funciona" className="scroll-mt-[72px] border-y border-ink-200 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-7 py-[88px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <Eyebrow>Como funciona</Eyebrow>
          <h2 className={h2}>Três passos, do QR Code ao seu Pix.</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {passos.map((p) => (
            <div key={p.n} className="flex flex-col gap-4 rounded-[24px] bg-ink-50 p-7">
              <div className="flex items-center justify-between">
                <span className={`flex size-[52px] items-center justify-center rounded-2xl ${p.iconCls}`}>{p.icon}</span>
                <span className="text-[48px] font-extrabold tracking-[-0.04em] text-ink-200">{p.n}</span>
              </div>
              <div className="text-[22px] font-extrabold tracking-[-0.02em]">{p.title}</div>
              <p className="m-0 text-[15px] leading-[1.55] text-ink-600">{p.text}</p>
            </div>
          ))}
          <div className="flex flex-col gap-4 rounded-[24px] bg-verde-600 p-7 text-white">
            <div className="flex items-center justify-between">
              <span className="flex size-[52px] items-center justify-center rounded-2xl bg-white text-verde-600">
                <CheckCircleFilled size={30} />
              </span>
              <span className="text-[48px] font-extrabold tracking-[-0.04em] text-white/30">03</span>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em]">Comissão no verdinho</div>
            <p className="m-0 text-[15px] leading-[1.55] text-verde-100">
              Entrevista de saúde aprovada: o consultor registra a venda, o status vira Verdinho ✓ e ele manda a sua parte por Pix.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const tickets = [800, 1000, 1500]

function Simulador() {
  const [n, setN] = useState(5)
  const [ticket, setTicket] = useState(1000)
  const cfg = useConfig()
  const per = cfg.data ? calcularSplit(ticket, cfg.data.aliquota_pf, cfg.data.pct_indicador, cfg.data.pct_consultor_restante).indicador : 0
  const semImposto = !!cfg.data && cfg.data.aliquota_pf == null

  return (
    <section className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-12 px-7 py-[88px]">
      <div className="flex flex-col gap-4">
        <Eyebrow>Simulador de ganhos</Eyebrow>
        <h2 className={h2}>Quanto você pode ganhar por mês?</h2>
        <p className="m-0 text-[17px] leading-[1.55] text-ink-600">
          Arraste para simular. Valores ilustrativos, para pessoa física.{semImposto && ' O imposto ainda está sendo definido, então a conta ainda não desconta imposto.'}</p>
      </div>
      <div className="flex flex-col gap-7 rounded-[28px] border border-ink-200 bg-white p-6 shadow-md sm:p-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sim-n" className="text-[15px] font-bold">
              Pessoas que fecham por mês
            </label>
            <span className="text-[28px] font-extrabold">{n}</span>
          </div>
          <input id="sim-n" type="range" min={1} max={20} value={n} onChange={(e) => setN(+e.target.value)} className="w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[15px] font-bold">Valor médio da adesão</span>
          <div className="flex flex-wrap gap-2">
            {tickets.map((t) => (
              <Chip key={t} active={ticket === t} onClick={() => setTicket(t)} className="rounded-[12px] px-4 py-[10px] text-[15px]">
                {brl(t).replace(',00', '')}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[20px] bg-ink-950 p-6 text-white" aria-live="polite">
          <span className="text-[14px] font-semibold text-verde-200">Você ganha aproximadamente</span>
          <span className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[52px]">
            {cfg.data ? brl(per * n) : '—'}
            <span className="text-[18px] tracking-normal opacity-60"> /mês</span>
          </span>
          <span className="text-[13px] text-ink-400">{cfg.data ? `${brl(per)} por adesão aprovada` : 'Simulação indisponível no momento'}</span>
        </div>
      </div>
    </section>
  )
}

function Split() {
  const cfg = useConfig()
  const c = cfg.data
  const r = c ? calcularSplit(1000, c.aliquota_pf, c.pct_indicador, c.pct_consultor_restante) : null
  const v = (x: number | undefined) => (x == null ? '—' : brl(x))
  return (
    <section className="bg-ink-950 text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 px-7 py-[88px]">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-verde-300">Transparência do split</Eyebrow>
          <h2 className={h2}>Metade do lucro líquido é sua. Sem letra miúda.</h2>
          <p className="m-0 text-[17px] leading-[1.6] text-ink-300">
            Do valor da adesão sai o imposto. Do que sobra, {c ? pct(c.pct_indicador) : 'metade'} é seu. Quem paga é o consultor, por Pix, depois da entrevista de saúde aprovada. A Geralindica não segura o seu dinheiro: você acompanha cada venda no painel.
          </p>
        </div>
        <div className="flex flex-col gap-[14px] rounded-[24px] bg-white p-7 text-ink-950">
          <span className="text-[18px] font-extrabold">Exemplo de adesão</span>
          <div className="flex justify-between text-[15px]">
            <span className="text-ink-600">Valor da adesão</span>
            <span className="font-bold">{brl(1000)}</span>
          </div>
          <div className="flex justify-between text-[15px]">
            <span className="text-ink-600">{!c ? 'Imposto' : c.aliquota_pf == null ? 'Imposto (a definir)' : `Imposto (${pct(c.aliquota_pf)} PF)`}</span>
            <span className="font-bold text-vermelho-fg">− {v(r?.imposto)}</span>
          </div>
          <div className="border-t border-dashed border-ink-200" />
          <div className="flex justify-between text-[16px]">
            <span className="font-bold">Valor líquido</span>
            <span className="font-extrabold">{v(r?.liquido)}</span>
          </div>
          <div className="my-1.5 flex h-3 gap-[3px] overflow-hidden rounded-full">
            <div className="bg-verde-600" style={{ flex: r?.indicador || 1 }} />
            <div className="bg-ink-800" style={{ flex: r?.resto || 1 }} />
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            <div className="rounded-[14px] bg-verde-50 p-[14px]">
              <div className="text-[12px] font-bold text-verde-700">{c ? pct(c.pct_indicador) : ''} Indicador</div>
              <div className="text-[20px] font-extrabold text-verde-900 sm:text-[24px]">{v(r?.indicador)}</div>
            </div>
            <div className="rounded-[14px] bg-ink-50 p-[14px]">
              <div className="text-[12px] font-bold text-ink-600">Consultor + Geralindica</div>
              <div className="text-[20px] font-extrabold sm:text-[24px]">{v(r?.resto)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const seguranca = [
  { icon: <Thermometer size={26} />, iconCls: 'bg-laranja-bg text-laranja-fg', title: 'Temperatura pública', text: 'Cada consultor tem uma temperatura na vitrine. Quem registra as vendas e paga os indicadores em dia fica quente; quem não paga esfria e deixa de receber indicadores.' },
  { icon: <ShieldUser size={26} />, iconCls: 'bg-ink-100 text-ink-950', title: 'LGPD por padrão', text: 'Quem indica vê só o primeiro nome do cliente, a data, o status e o valor a receber. CPF, telefone e dados de saúde ficam sempre mascarados.' },
  { icon: <ShieldCheck size={26} />, iconCls: 'bg-azul-bg text-azul-fg', title: 'Contrato assinado no Gov.br', text: 'Indicadores e consultores assinam o contrato com a conta Gov.br no cadastro. Validade jurídica, sem papel nem cartório.' },
]

function Seguranca() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-10 px-7 py-[88px]">
      <div className="flex max-w-[640px] flex-col gap-3">
        <Eyebrow>Segurança</Eyebrow>
        <h2 className={h2}>Confiança para todos os lados.</h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
        {seguranca.map((s) => (
          <div key={s.title} className="flex flex-col gap-[14px] rounded-[24px] border border-ink-200 bg-white p-7">
            <span className={`flex size-12 items-center justify-center rounded-[14px] ${s.iconCls}`}>{s.icon}</span>
            <div className="text-[20px] font-extrabold">{s.title}</div>
            <p className="m-0 text-[15px] leading-[1.55] text-ink-600">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const emBreve = [
  { icon: <Smile size={20} />, label: 'Odonto' },
  { icon: <Flower2 size={20} />, label: 'Estética' },
  { icon: <Apple size={20} />, label: 'Suplementos' },
  { icon: <Store size={20} />, label: 'Convênios' },
]

function ParaConsultores() {
  return (
    <section className="mx-auto max-w-[1200px] px-7 pb-[88px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-10 rounded-[28px] border border-ink-200 bg-white p-6 sm:p-10">
        <div className="flex flex-col gap-[14px]">
          <Eyebrow>Para consultores</Eyebrow>
          <h2 className="m-0 text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[36px]">Clientes de indicadores, direto no seu WhatsApp.</h2>
          <p className="m-0 text-[16px] leading-[1.6] text-ink-600">
            Monte uma carteira de até 30 indicadores, organize cada cliente no CRM e registre suas vendas para esquentar a sua temperatura na vitrine.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-[10px]">
            <Link to="/cadastro?papel=consultor" className={buttonVariants({ variant: 'dark', size: 'md' })}>
              Quero ser consultor
            </Link>
            <Link to="/consultores" className={buttonVariants({ variant: 'outline', size: 'md' })}>
              Ver ranking
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-[10px]">
          <span className="text-[13px] font-bold text-ink-600">Produtos</span>
          <div className="flex items-center gap-[14px] rounded-2xl border border-verde-200 bg-verde-50 px-4 py-[14px]">
            <ShieldPlus size={24} className="text-verde-700" />
            <span className="flex-1 font-extrabold">Plano de Saúde</span>
            <span className="rounded-full bg-verde-600 px-[10px] py-[3px] text-[12px] font-bold text-white">Ativo</span>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {emBreve.map((p) => (
              <div key={p.label} className="flex flex-wrap items-center gap-[10px] rounded-[14px] border border-dashed border-ink-200 px-[14px] py-3 text-[14px] font-bold text-ink-600">
                {p.icon}
                {p.label}
                <span className="ml-auto text-[11px]">Em breve</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="border-t border-ink-200 bg-white">
      <div className="mx-auto flex max-w-[860px] flex-col gap-8 px-7 py-[88px]">
        <h2 className="m-0 text-[32px] font-extrabold tracking-[-0.04em] sm:text-[40px]">Perguntas frequentes</h2>
        <Accordion.Root type="single" collapsible defaultValue="0" className="flex flex-col border-t border-ink-200">
          {faqs.map((f, i) => (
            <Accordion.Item key={f.q} value={String(i)} className="border-b border-ink-200">
              <Accordion.Header className="m-0">
                <Accordion.Trigger className="group flex w-full cursor-pointer items-center justify-between gap-4 bg-transparent py-[22px] text-left text-[18px] font-bold text-ink-950">
                  {f.q}
                  <Plus size={24} className="shrink-0 text-ink-600 group-data-[state=open]:hidden" />
                  <Minus size={24} className="hidden shrink-0 text-ink-600 group-data-[state=open]:block" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>
                <p className="m-0 mb-[22px] max-w-[700px] text-[16px] leading-[1.6] text-ink-600">{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  )
}

function CtaFinal() {
  return (
    <section className="mx-auto max-w-[1200px] px-7 py-[88px]">
      <div className="flex flex-col items-center gap-5 rounded-[32px] bg-verde-600 px-6 py-16 text-center text-white sm:px-12">
        <h2 className="m-0 max-w-[760px] text-balance text-[clamp(36px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.045em]">
          Seu primeiro QR Code fica pronto em 5 minutos.
        </h2>
        <p className="m-0 max-w-[540px] text-[18px] text-verde-100">Cadastro gratuito. Você escolhe o consultor e assina o contrato pelo Gov.br.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link to="/cadastro?papel=indicador" className={buttonVariants({ variant: 'light', size: 'lg', className: 'font-extrabold' })}>
            Quero indicar e ganhar
          </Link>
          <Link to="/cadastro?papel=consultor" className={buttonVariants({ variant: 'outlineLight', size: 'lg' })}>
            Sou consultor
          </Link>
        </div>
      </div>
    </section>
  )
}

export function Landing() {
  return (
    <main>
      <Hero />
      <ComoFunciona />
      <Simulador />
      <Split />
      <Seguranca />
      <ParaConsultores />
      <Faq />
      <CtaFinal />
    </main>
  )
}
