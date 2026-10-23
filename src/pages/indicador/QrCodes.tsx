import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Armchair, Camera, Check, Copy, IdCard, Loader2, Pencil, Plus } from 'lucide-react'
import { supabase, mensagemErro } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Card, TituloPagina } from '@/components/painel/comum'
import { QR } from '@/components/painel/QR'
import { Logo } from '@/components/Logo'
import { Carregando, ErroBox, Modal, useToast } from '@/components/ui/feedback'
import { linkCanal, rotuloCanal, useCanais } from './dados'
import { baixarArte, type TipoArte } from './artes'

const SUGESTOES = ['Carro · capa de encosto', 'Cartão de visita', 'Instagram · story', 'Balcão da loja', 'Banner', 'Status do WhatsApp']

export function QrCodes() {
  const { session } = useAuth()
  const canais = useCanais()
  const qc = useQueryClient()
  const toast = useToast()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id?: string; nome: string } | null>(null)

  const salvar = useMutation({
    mutationFn: async ({ id, nome }: { id?: string; nome: string }) => {
      const r = id
        ? await supabase.from('canais').update({ nome }).eq('id', id)
        : await supabase.from('canais').insert({ indicador_id: session!.user.id, nome })
      if (r.error) throw r.error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ind', 'canais'] })
      toast(v.id ? 'Canal renomeado.' : 'Novo canal criado com QR Code próprio.')
      setEditando(null)
    },
    onError: (e) => toast(mensagemErro(e), 'erro'),
  })

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(linkCanal(codigo))
      setCopiado(codigo)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'erro')
    }
  }

  const baixar = async (tipo: TipoArte, codigo: string, numero: number) => {
    setBaixando(codigo + tipo)
    try {
      await baixarArte(tipo, linkCanal(codigo), rotuloCanal(numero), codigo)
    } catch (e) {
      toast(mensagemErro(e), 'erro')
    } finally {
      setBaixando(null)
    }
  }

  const primeiro = canais.data?.[0]

  return (
    <>
      <TituloPagina titulo="Meus QR Codes">
        <Button variant="dark" size="sm" onClick={() => setEditando({ nome: '' })}>
          <Plus size={19} />
          Novo canal
        </Button>
      </TituloPagina>
      <p className="-mt-3 m-0 text-[14px] text-ink-600">Cada canal tem um código próprio, então você sabe de onde veio cada cliente.</p>

      {canais.isLoading ? (
        <Carregando />
      ) : canais.error ? (
        <ErroBox erro={canais.error} onRetry={() => canais.refetch()} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5">
          {canais.data!.map((c) => (
            <Card key={c.id} className="flex flex-col gap-4 rounded-[20px] p-[18px]">
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-[14px] border border-ink-200 bg-white p-2">
                  <QR texto={linkCanal(c.codigo)} size={96} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="self-start rounded-md bg-ink-950 px-2 py-[3px] font-mono text-[11px] font-semibold text-white">{rotuloCanal(c.numero)}</span>
                  <button type="button" onClick={() => setEditando({ id: c.id, nome: c.nome })} className="group flex cursor-pointer items-center gap-1.5 text-left text-[17px] font-extrabold">
                    <span className="truncate">{c.nome}</span>
                    <Pencil size={14} className="shrink-0 text-ink-400 group-hover:text-ink-950" />
                  </button>
                  <div className="text-[13px] text-ink-600">
                    <b className="text-[22px] tracking-[-0.02em] text-ink-950">{c.escaneamentos.toLocaleString('pt-BR')}</b> escaneamentos
                  </div>
                  <div className="text-[12px] font-bold text-verde-700">
                    {c.fechados} {c.fechados === 1 ? 'fechado' : 'fechados'} · {c.aprovados} {c.aprovados === 1 ? 'aprovado' : 'aprovados'}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold text-ink-600">Baixar arte</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['encosto', 'Encosto', Armchair],
                      ['cartao', 'Cartão', IdCard],
                      ['story', 'Story', Camera],
                    ] as const
                  ).map(([tipo, label, Icon]) => (
                    <button
                      key={tipo}
                      type="button"
                      disabled={baixando === c.codigo + tipo}
                      onClick={() => baixar(tipo, c.codigo, c.numero)}
                      className="flex h-10 cursor-pointer items-center justify-center gap-1 rounded-[10px] border border-ink-200 bg-white text-[12px] font-bold hover:border-ink-950 disabled:opacity-60"
                    >
                      {baixando === c.codigo + tipo ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => copiar(c.codigo)}
                  className="flex h-[42px] cursor-pointer items-center gap-2 rounded-[10px] border border-ink-200 bg-ink-50 px-3 text-left"
                >
                  <span className="flex-1 truncate font-mono text-[12px] text-ink-600">{linkCanal(c.codigo).replace(/^https?:\/\//, '')}</span>
                  <span className={`flex items-center gap-1 text-[12px] font-extrabold ${copiado === c.codigo ? 'text-verde-700' : 'text-ink-950'}`}>
                    {copiado === c.codigo ? <Check size={15} /> : <Copy size={15} />}
                    {copiado === c.codigo ? 'Copiado' : 'Copiar'}
                  </span>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {primeiro && (
        <Card className="flex flex-col gap-3.5 rounded-[20px] p-5">
          <span className="text-[16px] font-extrabold">Prévia · capa de encosto ({rotuloCanal(primeiro.numero)})</span>
          <div className="flex aspect-[3/4] w-[220px] flex-col items-center gap-3 self-center rounded-[22px_22px_14px_14px] bg-verde-600 px-[18px] py-[22px] text-center text-white">
            <span className="text-[18px] font-extrabold leading-[1.15] tracking-[-0.02em]">Plano de saúde sem fila de corretor</span>
            <div className="rounded-[12px] bg-white p-2">
              <QR texto={linkCanal(primeiro.codigo)} size={120} />
            </div>
            <span className="text-[12px] font-semibold opacity-90">Aponte a câmera e receba sua cotação no WhatsApp</span>
            <Logo small className="mt-auto gap-1.5 text-[15px] text-white [&>img]:size-5" />
          </div>
          <p className="m-0 text-center text-[12px] text-ink-600">
            Ao escanear, o cliente abre o WhatsApp da Geralindica já com o código <b className="font-mono">{primeiro.codigo}</b>. O escaneamento é contado aqui.
          </p>
        </Card>
      )}

      <Modal aberto={!!editando} onFechar={() => setEditando(null)} titulo={editando?.id ? 'Renomear canal' : 'Novo canal'} sheetNoMobile={false}>
        {editando && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (editando.nome.trim().length < 2) return toast('Dê um nome ao canal (ex.: Cartão de visita).', 'erro')
              salvar.mutate({ id: editando.id, nome: editando.nome.trim() })
            }}
          >
            <Field label="Onde você vai divulgar?" value={editando.nome} maxLength={40} autoFocus onChange={(e) => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex.: Cartão de visita" />
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button key={s} type="button" onClick={() => setEditando({ ...editando, nome: s })} className="cursor-pointer rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-bold hover:border-ink-950">
                  {s}
                </button>
              ))}
            </div>
            <Button type="submit" variant="primary" size="form" disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {editando.id ? 'Salvar' : 'Criar canal com QR Code'}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
