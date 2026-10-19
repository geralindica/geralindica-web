import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { painelDe, useAuth } from '@/auth/AuthProvider'
import { Field } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/feedback'

export function RedefinirSenha() {
  const { session, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [senha, setSenha] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const salvar = async () => {
    setErro('')
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== conf) return setErro('As senhas não conferem.')
    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setCarregando(false)
    if (error) return setErro(mensagemErro(error))
    toast('Senha atualizada.')
    nav(profile ? painelDe(profile.papel) : '/entrar', { replace: true })
  }

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 justify-center px-4 pb-24 pt-12 sm:px-7">
      <form
        onSubmit={(e) => (e.preventDefault(), salvar())}
        className="flex w-full max-w-[440px] flex-col gap-5 self-start rounded-[28px] border border-ink-200 bg-white p-6 sm:p-9"
      >
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.035em]">Nova senha</h1>
        {!session ? (
          <p className="m-0 text-[14px] leading-[1.55] text-ink-600">Abra esta página pelo link enviado ao seu e-mail. Se o link expirou, peça outro em "Esqueci minha senha".</p>
        ) : (
          <>
            <Field label="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <Field label="Repita a nova senha" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
            {erro && (
              <div role="alert" className="rounded-[12px] bg-vermelho-bg px-3.5 py-2.5 text-[14px] font-semibold text-vermelho-fg">
                {erro}
              </div>
            )}
            <Button type="submit" variant="primary" size="form" disabled={carregando}>
              {carregando && <Loader2 size={18} className="animate-spin" />}
              Salvar nova senha
            </Button>
          </>
        )}
      </form>
    </main>
  )
}
