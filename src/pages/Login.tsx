import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { painelDe, useAuth } from '@/auth/AuthProvider'
import { Field } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'

// Contas de demonstração (só aparecem rodando localmente; ver supabase/seed.sql).
const DEMO = import.meta.env.DEV
  ? [
      { label: 'Indicador', email: 'carlos.mendes@demo.geralindica.com.br', cor: 'bg-verde-600 hover:bg-verde-700' },
      { label: 'Consultor', email: 'juliana.prado@demo.geralindica.com.br', cor: 'bg-ink-950 hover:bg-ink-800' },
      { label: 'Admin', email: 'admin@demo.geralindica.com.br', cor: 'bg-ink-800 hover:bg-ink-950' },
    ]
  : []
// Senha das contas de demonstração: só no .env.local (VITE_DEMO_SENHA), nunca no código.
const DEMO_SENHA = import.meta.env.DEV ? (import.meta.env.VITE_DEMO_SENHA ?? '') : ''

export function Login() {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [modo, setModo] = useState<'entrar' | 'esqueci'>('entrar')

  useEffect(() => {
    if (session && profile) {
      const voltar = params.get('voltar')
      nav(voltar && voltar.startsWith(painelDe(profile.papel)) ? voltar : painelDe(profile.papel), { replace: true })
    }
  }, [session, profile, nav, params])

  const entrar = async (e?: string, s?: string) => {
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: (e ?? email).trim(), password: s ?? senha })
    setCarregando(false)
    if (error) setErro(mensagemErro(error))
  }

  const recuperar = async () => {
    setErro('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Digite o e-mail da sua conta.')
    setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/redefinir-senha` })
    setCarregando(false)
    if (error) return setErro(mensagemErro(error))
    toast('Enviamos um link para redefinir sua senha. Confira seu e-mail.')
    setModo('entrar')
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 justify-center px-4 pb-24 pt-12 sm:px-7">
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          if (modo === 'entrar') entrar()
          else recuperar()
        }}
        className="flex w-full max-w-[440px] flex-col gap-5 self-start rounded-[28px] border border-ink-200 bg-white p-6 sm:p-9"
      >
        <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.035em]">{modo === 'entrar' ? 'Entrar na Geralindica' : 'Recuperar senha'}</h1>
        <Field label="E-mail" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required />
        {modo === 'entrar' && <Field label="Senha" name="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />}
        {erro && (
          <div role="alert" className="rounded-[12px] bg-vermelho-bg px-3.5 py-2.5 text-[14px] font-semibold text-vermelho-fg">
            {erro}
          </div>
        )}
        <Button type="submit" variant="primary" size="form" className="h-[50px] text-[15px] font-extrabold" disabled={carregando}>
          {carregando && <Loader2 size={18} className="animate-spin" />}
          {modo === 'entrar' ? 'Entrar' : 'Enviar link de recuperação'}
        </Button>
        <button type="button" onClick={() => (setErro(''), setModo(modo === 'entrar' ? 'esqueci' : 'entrar'))} className="cursor-pointer self-center text-[13px] font-bold text-ink-600 hover:text-ink-950">
          {modo === 'entrar' ? 'Esqueci minha senha' : 'Voltar para o login'}
        </button>
        <div className="text-center text-[14px] text-ink-600">
          Ainda não tem conta?{' '}
          <Link to="/cadastro?papel=indicador" className="font-bold text-verde-700 hover:text-verde-900">
            Criar conta
          </Link>
        </div>
        {DEMO.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-dashed border-ink-200 pt-4">
            <span className="text-center text-[12px] font-bold uppercase tracking-[.06em] text-ink-400">Demonstração (só no ambiente local)</span>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={carregando}
                  onClick={() => entrar(d.email, DEMO_SENHA)}
                  className={`h-11 cursor-pointer rounded-[12px] text-[13px] font-extrabold text-white ${d.cor}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </main>
  )
}
