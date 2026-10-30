import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, FileText, Headset, Info, MailCheck, QrCode, ShieldCheck } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { painelDe, useAuth } from '@/auth/AuthProvider'
import { useConsultores } from '@/data/queries'
import { assinarContratoGovBr } from '@/integrations'
import { TemperaturaBadge } from '@/components/ui/badges'
import { cnpjValido, cpfValido, formatarCNPJ, formatarCPF, formatarTelefone } from '@/lib/negocio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { CheckCircleFilled } from '@/components/icons'
import { Avatar } from '@/components/painel/comum'
import { cn } from '@/lib/utils'

type Role = 'ind' | 'con'

const PERFIS = ['Motorista de app', 'Comércio', 'Criador de conteúdo', 'Salão de beleza', 'Farmácia', 'Outro']
const h1 = 'm-0 text-[26px] font-extrabold tracking-[-0.035em] sm:text-[30px]'

function Stepper({ names, step }: { names: string[]; step: number }) {
  const cur = Math.min(step, 4)
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-2 rounded-[18px] border border-ink-200 bg-white px-[22px] py-[18px]">
      {names.map((n, i) => {
        const k = i + 1
        const done = k < cur || step > 4
        const isCur = k === cur && step <= 4
        return (
          <li key={n} className={cn('flex items-center gap-2', k < 4 ? 'flex-1' : 'flex-none')} aria-current={isCur ? 'step' : undefined}>
            <span className={cn('flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold', done ? 'bg-verde-600 text-white' : isCur ? 'bg-ink-950 text-white' : 'bg-ink-100 text-ink-600')}>
              {done ? '✓' : k}
            </span>
            <span className={cn('text-[13px] font-bold', done || isCur ? 'text-ink-950' : 'text-ink-400')}>{n}</span>
            {k < 4 && <span className={cn('h-0.5 min-w-4 flex-1', done ? 'bg-verde-600' : 'bg-ink-200')} />}
          </li>
        )
      })}
    </ol>
  )
}

export function Cadastro() {
  const [params] = useSearchParams()
  const { session, profile } = useAuth()
  const consultores = useConsultores()
  const initialRole: Role = params.get('papel') === 'consultor' ? 'con' : 'ind'
  const preId = params.get('consultor') ?? ''

  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role>(initialRole)
  const [pj, setPj] = useState(false)
  const [d, setD] = useState({ nome: '', razao: '', doc: '', tel: '', email: '', senha: '', perfil: PERFIS[0], susep: '', cidade: '', administradora: '', limite: '30' })
  const [pickId, setPickId] = useState(preId)
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<{ assinadoEm: string; precisaConfirmar: boolean } | null>(null)

  // Reinicia o fluxo quando o link muda (ex.: "Sou consultor" clicado de dentro do cadastro).
  const key = params.toString()
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setStep(1)
    setRole(initialRole)
    setPickId(preId)
    setErro('')
  }

  const isInd = role === 'ind'
  const stepNames = ['Papel', 'Dados', isInd ? 'Consultor' : 'Atuação', 'Gov.br']
  const comVaga = useMemo(() => (consultores.data ?? []).filter((c) => !c.full), [consultores.data])
  const lista = useMemo(() => {
    const base = comVaga.slice(0, 5)
    const pre = comVaga.find((c) => c.id === pickId)
    if (pre && !base.includes(pre)) base[base.length - 1] = pre
    return base
  }, [comVaga, pickId])

  useEffect(() => {
    if (!pickId && comVaga[0]) setPickId(comVaga[0].id)
  }, [comVaga, pickId])

  const set = (k: keyof typeof d) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value })

  const validar = (): string => {
    if (step === 2) {
      if (pj && d.razao.trim().length < 3) return 'Informe a razão social.'
      if (d.nome.trim().split(/\s+/).length < 2) return pj ? 'Informe o nome completo do responsável.' : 'Informe seu nome completo.'
      if (pj ? !cnpjValido(d.doc) : !cpfValido(d.doc)) return pj ? 'CNPJ inválido.' : 'CPF inválido.'
      if (d.tel.replace(/\D/g, '').length < 10) return 'Informe um celular com DDD.'
      if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) return 'E-mail inválido.'
      if (d.senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
    }
    if (step === 3) {
      if (isInd && !pickId) return 'Escolha um consultor com vaga.'
      if (!isInd && d.susep.trim().length < 6) return 'Informe seu registro SUSEP.'
      if (!isInd && d.cidade.trim().length < 3) return 'Informe sua cidade de atuação.'
    }
    if (step === 4 && !aceite) return 'Você precisa aceitar os termos para continuar.'
    return ''
  }

  const next = () => {
    const e = validar()
    setErro(e)
    if (!e) setStep(step + 1)
  }
  const back = () => (setErro(''), setStep(Math.max(1, step - 1)))

  // Etapa 5: Gov.br (simulado) e criação da conta
  useEffect(() => {
    if (step !== 5) return
    let ativo = true
    ;(async () => {
      try {
        const { assinadoEm } = await assinarContratoGovBr()
        const { data, error } = await supabase.auth.signUp({
          email: d.email.trim(),
          password: d.senha,
          options: {
            emailRedirectTo: `${window.location.origin}/entrar`,
            data: {
              papel: isInd ? 'indicador' : 'consultor',
              nome: d.nome.trim(),
              tipo_pessoa: pj ? 'PJ' : 'PF',
              documento: d.doc,
              telefone: d.tel,
              contrato_assinado_em: assinadoEm,
              ...(isInd
                ? { consultor_id: pickId, perfil: d.perfil, razao_social: pj ? d.razao.trim() : undefined }
                : { cidade: d.cidade.trim(), susep: d.susep.trim(), administradora: d.administradora.trim(), max_indicadores: Number(d.limite) || 30 }),
            },
          },
        })
        if (!ativo) return
        if (error) throw error
        // Supabase devolve usuário sem identidades quando o e-mail já existe
        if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('User already registered')
        setResultado({ assinadoEm, precisaConfirmar: !data.session })
        setStep(6)
      } catch (e) {
        if (!ativo) return
        setErro(mensagemErro(e))
        setStep(2)
      }
    })()
    return () => {
      ativo = false
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  if (session && profile && step < 5)
    return (
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 justify-center px-4 pb-24 pt-12">
        <div className="flex w-full max-w-[520px] flex-col items-center gap-4 self-start rounded-[28px] border border-ink-200 bg-white p-9 text-center">
          <h1 className="m-0 text-[26px] font-extrabold">Você já tem conta</h1>
          <p className="m-0 text-[15px] text-ink-600">Você está conectado como {profile.nome}.</p>
          <Link to={painelDe(profile.papel)} className={buttonVariants({ variant: 'dark', size: 'md' })}>
            Ir para o meu painel
          </Link>
        </div>
      </main>
    )

  const roleCard = 'flex cursor-pointer flex-col gap-[10px] rounded-[20px] border-2 p-[22px] text-left'

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 justify-center px-4 pb-24 pt-12 sm:px-7">
      <div className="flex w-full max-w-[760px] flex-col gap-6">
        <Stepper names={stepNames} step={step} />

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (step <= 4) next()
          }}
          className="flex flex-col gap-6 rounded-[28px] border border-ink-200 bg-white p-6 sm:p-9"
        >
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h1 className={h1}>Como você quer usar a Geralindica?</h1>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[14px]" role="radiogroup" aria-label="Papel">
                <button type="button" role="radio" aria-checked={isInd} onClick={() => setRole('ind')} className={cn(roleCard, isInd ? 'border-verde-600 bg-verde-50' : 'border-ink-200 bg-white')}>
                  <QrCode size={30} className="text-verde-700" />
                  <span className="text-[19px] font-extrabold">Indicador</span>
                  <span className="text-[14px] leading-[1.5] text-ink-600">Espalho QR Codes e ganho 50% do lucro líquido de cada adesão aprovada.</span>
                </button>
                <button type="button" role="radio" aria-checked={!isInd} onClick={() => setRole('con')} className={cn(roleCard, !isInd ? 'border-ink-950 bg-ink-50' : 'border-ink-200 bg-white')}>
                  <Headset size={30} className="text-ink-950" />
                  <span className="text-[19px] font-extrabold">Consultor</span>
                  <span className="text-[14px] leading-[1.5] text-ink-600">Sou corretor, recebo leads qualificados e cuido de uma carteira de indicadores.</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className={h1}>Seus dados</h1>
                <div className="flex rounded-[12px] bg-ink-100 p-1" role="tablist" aria-label="Tipo de pessoa">
                  {(
                    [
                      [false, 'Pessoa física'],
                      [true, 'Pessoa jurídica'],
                    ] as const
                  ).map(([v, l]) => (
                    <button
                      key={l}
                      type="button"
                      role="tab"
                      aria-selected={pj === v}
                      onClick={() => (setPj(v), setD({ ...d, doc: '' }))}
                      className={cn('cursor-pointer rounded-[9px] px-4 py-2 text-[14px] font-bold text-ink-950', pj === v ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'bg-transparent')}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[14px]">
                {pj && <Field label="Razão social" value={d.razao} onChange={set('razao')} placeholder="Mendes Transportes ME" autoComplete="organization" />}
                <Field label={pj ? 'Responsável (nome completo)' : 'Nome completo'} value={d.nome} onChange={set('nome')} placeholder="Carlos Eduardo Mendes" autoComplete="name" />
                <Field
                  label={pj ? 'CNPJ' : 'CPF'}
                  value={d.doc}
                  inputMode="numeric"
                  onChange={(e) => setD({ ...d, doc: pj ? formatarCNPJ(e.target.value) : formatarCPF(e.target.value) })}
                  placeholder={pj ? '00.000.000/0000-00' : '000.000.000-00'}
                />
                <Field label="Celular (WhatsApp)" value={d.tel} type="tel" inputMode="tel" autoComplete="tel" onChange={(e) => setD({ ...d, tel: formatarTelefone(e.target.value) })} placeholder="(19) 98871-4471" />
                <Field label="E-mail" value={d.email} type="email" autoComplete="email" onChange={set('email')} placeholder="voce@email.com" />
                <Field label="Crie uma senha" value={d.senha} type="password" autoComplete="new-password" onChange={set('senha')} placeholder="Mínimo de 8 caracteres" />
              </div>
              <div className="flex items-start gap-[10px] rounded-[14px] bg-ink-50 px-4 py-[14px] text-[13px] leading-[1.5] text-ink-600">
                <Info size={20} className="shrink-0 text-verde-700" />
                {pj
                  ? 'Como PJ, o imposto descontado da comissão segue o seu enquadramento. Informe um CNPJ válido.'
                  : 'Como PF, o imposto é descontado do valor da adesão antes da divisão. O seu consultor manda a sua parte por Pix.'}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-[18px]">
              <h1 className={h1}>{isInd ? 'Escolha seu consultor' : 'Sua atuação'}</h1>
              <p className="m-0 text-[15px] text-ink-600">
                {isInd ? 'Ele vai atender os clientes que chegarem pelos seus QR Codes. Você pode trocar depois.' : 'Essas informações aparecem no seu perfil público na vitrine.'}
              </p>
              {isInd ? (
                <>
                  <div className="flex flex-col gap-[10px]" role="radiogroup" aria-label="Consultor">
                    {consultores.isLoading && <div className="text-[14px] text-ink-600">Carregando consultores…</div>}
                    {lista.map((c) => {
                      const sel = c.id === pickId
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          onClick={() => setPickId(c.id)}
                          className={cn('flex cursor-pointer items-center gap-[14px] rounded-2xl border-2 px-4 py-[14px] text-left', sel ? 'border-verde-600 bg-verde-50' : 'border-ink-200 bg-white')}
                        >
                          <Avatar nome={c.nome_exibicao} foto={c.foto_url} size={44} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 font-extrabold">
                              {c.nome_exibicao}
                              <TemperaturaBadge valor={c.temperatura} small />
                            </div>
                            <div className="text-[13px] text-ink-600">
                              {c.cidade} · {c.conv}% conversão
                            </div>
                          </div>
                          <span className="hidden text-[13px] font-bold sm:inline" style={{ color: c.barColor }}>
                            {c.vagaLabel}
                          </span>
                          <CheckCircleFilled size={24} className={cn('shrink-0 text-verde-600', !sel && 'opacity-0')} />
                        </button>
                      )
                    })}
                  </div>
                  <Link to="/consultores" target="_blank" className="self-start text-[13px] font-bold text-verde-700">
                    Ver todos na vitrine →
                  </Link>
                  <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                    Onde você vai divulgar?
                    <select value={d.perfil} onChange={set('perfil')} className="h-12 rounded-[12px] border border-ink-200 bg-white px-3 text-[15px] font-medium outline-none focus:border-verde-500">
                      {PERFIS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[14px]">
                  <Field label="Registro SUSEP" value={d.susep} onChange={set('susep')} placeholder="10.2938.4471-0" />
                  <Field label="Cidade de atuação" value={d.cidade} onChange={set('cidade')} placeholder="Campinas, SP" />
                  <Field label="Administradora parceira" value={d.administradora} onChange={set('administradora')} placeholder="Qualivida Administradora" />
                  <Field label="Limite de indicadores (até 30)" type="number" min={1} max={30} value={d.limite} onChange={set('limite')} />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-[18px]">
              <h1 className={h1}>Assine o contrato pelo Gov.br</h1>
              <div className="flex flex-col gap-3 rounded-[18px] border border-ink-200 bg-ink-50 p-5">
                <div className="flex items-center gap-3">
                  <FileText size={28} className="shrink-0 text-ink-600" />
                  <div className="flex-1">
                    <div className="font-extrabold">{isInd ? 'Contrato de Indicação Comercial' : 'Contrato de Parceria de Corretagem'}</div>
                    <div className="text-[13px] text-ink-600">Prestação de serviços de agenciamento de leads e marketing · sem vínculo CLT</div>
                  </div>
                </div>
                <ul className="m-0 pl-5 text-[14px] leading-[1.7] text-ink-800">
                  {(isInd
                    ? [
                        'Comissão de 50% do lucro líquido de cada adesão aprovada, paga pelo consultor via Pix.',
                        'O consultor segura o pagamento até a entrevista de saúde e devolve 100% ao cliente se reprovado.',
                        'Acesso apenas a dados não sensíveis dos clientes (LGPD).',
                        'Autonomia total: sem subordinação, sem exclusividade.',
                      ]
                    : [
                        'Carteira de até 30 indicadores, com portabilidade livre.',
                        'Atender o cliente, registrar cada venda na plataforma e fazer os Pix do indicador e da Geralindica.',
                        'Tratamento de dados de saúde conforme LGPD e normas da ANS.',
                        'Acompanhamento por relatórios do CRM, sem monitoramento de conversas.',
                      ]
                  ).map((cl) => (
                    <li key={cl}>{cl}</li>
                  ))}
                </ul>
              </div>
              <label className="flex cursor-pointer items-center gap-[10px] text-[14px] font-semibold">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="peer sr-only" />
                <span
                  className={cn(
                    'flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-verde-500 peer-focus-visible:ring-offset-2',
                    aceite ? 'border-verde-600 bg-verde-600 text-white' : 'border-ink-200 bg-white text-transparent',
                  )}
                >
                  <Check size={16} strokeWidth={3} />
                </span>
                Li e concordo com os termos e a política de privacidade (LGPD).
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col items-center gap-5 py-10 text-center" role="status">
              <div className="size-16 animate-spin rounded-full border-[5px] border-azul-bg border-t-azul-fg [animation-duration:1s]" />
              <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.03em]">Assinando pelo Gov.br…</h1>
              <p className="m-0 max-w-[420px] text-[15px] text-ink-600">Você entra com sua conta Gov.br (nível prata ou ouro) e assina o contrato. Em seguida criamos sua conta na Geralindica.</p>
            </div>
          )}

          {step === 6 && resultado && (
            <div className="flex flex-col items-center gap-[18px] py-6 text-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-verde-600 text-white shadow-[0_12px_32px_rgba(15,157,88,.35)]">
                <Check size={44} strokeWidth={3} />
              </span>
              <h1 className="m-0 text-[32px] font-extrabold tracking-[-0.035em]">Contrato assinado!</h1>
              <p className="m-0 max-w-[440px] text-[16px] leading-[1.55] text-ink-600">
                {isInd
                  ? 'Seu primeiro QR Code já está pronto. Imprima a capa de encosto ou compartilhe o link e comece a indicar hoje.'
                  : 'Seu perfil já aparece na vitrine. Assim que indicadores entrarem na sua carteira, os leads chegam no seu CRM.'}
              </p>
              <div className="flex items-center gap-[10px] rounded-[12px] bg-azul-bg px-4 py-[10px] text-[13px] font-bold text-azul-fg">
                <ShieldCheck size={18} />
                Assinado via Gov.br em {new Date(resultado.assinadoEm).toLocaleDateString('pt-BR')} às{' '}
                {new Date(resultado.assinadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {resultado.precisaConfirmar ? (
                <div className="flex max-w-[460px] items-start gap-2.5 rounded-[14px] bg-ambar-bg px-4 py-3.5 text-left text-[14px] font-semibold leading-[1.5] text-ambar-fg">
                  <MailCheck size={20} className="shrink-0" />
                  Enviamos um link de confirmação para {d.email}. Confirme o e-mail e depois entre com sua senha.
                </div>
              ) : (
                <Link to={isInd ? '/indicador/qr' : '/consultor/perfil'} className={buttonVariants({ variant: 'dark', size: 'lg', className: 'font-extrabold' })}>
                  Ir para o meu painel
                  <ArrowRight size={20} />
                </Link>
              )}
              {resultado.precisaConfirmar && (
                <Link to="/entrar" className={buttonVariants({ variant: 'dark', size: 'lg', className: 'font-extrabold' })}>
                  Ir para o login
                </Link>
              )}
            </div>
          )}

          {erro && (
            <div role="alert" className="rounded-[12px] bg-vermelho-bg px-3.5 py-2.5 text-[14px] font-semibold text-vermelho-fg">
              {erro}
            </div>
          )}

          {step <= 4 && (
            <div className="flex justify-between gap-3 border-t border-ink-100 pt-[22px]">
              <Button variant="outline" size="form" onClick={back} disabled={step === 1} className="disabled:opacity-50">
                Voltar
              </Button>
              <Button type="submit" variant={step === 4 ? 'gov' : 'primary'} size="form" className="px-6 font-extrabold">
                {step === 4 ? 'Assinar com Gov.br' : 'Continuar'}
                <ArrowRight size={20} />
              </Button>
            </div>
          )}
        </form>
        {step === 1 && (
          <p className="m-0 text-center text-[14px] text-ink-600">
            Já tem conta?{' '}
            <Link to="/entrar" className="font-bold text-verde-700">
              Entrar
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
