import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loader2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { linkWhatsApp } from '@/integrations'
import { Logo } from '@/components/Logo'

/** Destino do QR Code: conta o escaneamento e abre o WhatsApp com o código do canal. */
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
      window.location.replace(url)
    })
    return () => {
      ativo = false
    }
  }, [codigo])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-verde-600 px-6 text-center text-white">
      <Logo className="text-[32px] text-white [&>span]:bg-white" />
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
          <Loader2 size={36} className="animate-spin" />
          <h1 className="m-0 text-[24px] font-extrabold">Abrindo o WhatsApp…</h1>
          <p className="m-0 max-w-[360px] text-[15px] text-verde-100">Você vai falar com nosso atendimento e receber sua cotação de plano de saúde.</p>
          {link && (
            <a href={link} className="flex items-center gap-2 rounded-[14px] bg-white px-6 py-3.5 text-[15px] font-extrabold text-verde-900">
              <MessageCircle size={20} />
              Abrir conversa
            </a>
          )}
        </>
      )}
    </main>
  )
}
