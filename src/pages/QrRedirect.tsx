import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { linkWhatsApp } from '@/integrations'
import { Logo } from '@/components/Logo'

/**
 * Destino do QR Code: conta o escaneamento e leva ao WhatsApp do consultor do indicador com o código do canal.
 * Antes, pede o consentimento do cliente para compartilhar o contato (cláusula 9.2 a do contrato do indicador, LGPD).
 */
export function QrRedirect() {
  const { codigo = '' } = useParams()
  const [link, setLink] = useState<string | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    supabase.rpc('registrar_escaneamento', { p_codigo: codigo }).then(({ data, error }) => {
      if (!ativo) return
      const r = (data as { whatsapp: string; mensagem: string }[] | null)?.[0]
      if (error || !r) return setErro(true)
      const url = linkWhatsApp(r.whatsapp, r.mensagem)
      setLink(url)
    })
    return () => {
      ativo = false
    }
  }, [codigo])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-verde-600 px-6 text-center text-white">
      <Logo branca className="h-9" />
      {erro ? (
        <>
          <h1 className="m-0 text-[24px] font-extrabold">Código não encontrado</h1>
          <p className="m-0 max-w-[360px] text-[15px] text-verde-100">Este QR Code não está mais ativo. Você ainda pode pedir sua cotação pelo site.</p>
          <Link to="/" className="rounded-[14px] bg-white px-6 py-3.5 text-[15px] font-extrabold text-verde-900">
            Ir para o site
          </Link>
        </>
      ) : (
        <>
          <h1 className="m-0 text-[24px] font-extrabold">Simulação de plano de saúde</h1>
          <p className="m-0 max-w-[380px] text-[15px] text-verde-100">Você vai falar no WhatsApp com um consultor de planos de saúde parceiro da Geralindica.</p>
          <p className="m-0 max-w-[380px] rounded-[14px] bg-verde-700/50 px-4 py-3 text-[13px] leading-[1.5] text-verde-50">
            Ao continuar, você concorda em compartilhar seu nome e telefone com esse consultor, só para fazer a sua simulação (Lei Geral de Proteção de Dados).{' '}
            <Link to="/privacidade" className="font-bold underline">
              Privacidade
            </Link>
          </p>
          {link ? (
            <a href={link} className="flex items-center gap-2 rounded-[14px] bg-white px-6 py-3.5 text-[15px] font-extrabold text-verde-900">
              <MessageCircle size={20} />
              Concordo, abrir o WhatsApp
            </a>
          ) : (
            <Loader2 size={32} className="animate-spin" />
          )}
        </>
      )}
    </main>
  )
}
