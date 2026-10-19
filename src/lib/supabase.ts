import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local (veja .env.example).')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Converte erros do Postgres/Supabase em mensagens legíveis para a interface. */
export function mensagemErro(e: unknown): string {
  if (!e) return 'Algo deu errado. Tente de novo.'
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/User already registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Faça login.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'
  if (/Password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit/i.test(msg)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (/Email address .* is invalid|invalid email/i.test(msg)) return 'Este e-mail não é válido. Confira e tente de novo.'
  if (/Error sending confirmation email|sending .*email/i.test(msg)) return 'Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.'
  if (/Signups not allowed/i.test(msg)) return 'Novos cadastros estão temporariamente fechados.'
  if (/JWT expired|session.*expired/i.test(msg)) return 'Sua sessão expirou. Entre de novo.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.'
  return msg
}
