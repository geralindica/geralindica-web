import { useState } from 'react'
import { useConfig } from '@/data/queries'
import type { StatusVenda, VendaIndicador } from '@/lib/types'
import { Chip } from '@/components/ui/form'
import { AvisoPagamento, Card, DetalheVenda, LinhaVenda, SeloLGPD, TituloPagina } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio } from '@/components/ui/feedback'
import { useVendas } from './dados'

const FILTROS: { k: string; label: string; st: StatusVenda | null }[] = [
  { k: 'todos', label: 'Todas', st: null },
  { k: 'aprovado', label: 'Verdinho', st: 'aprovado' },
  { k: 'aguardando', label: 'Aguardando entrevista', st: 'aguardando_entrevista' },
  { k: 'reprovado', label: 'Reprovadas', st: 'reprovado' },
]

export function Extrato() {
  const vendas = useVendas()
  const config = useConfig()
  const [filtro, setFiltro] = useState('todos')
  const [aberta, setAberta] = useState<VendaIndicador | null>(null)
  const f = FILTROS.find((x) => x.k === filtro)!
  const itens = (vendas.data ?? []).filter((v) => !f.st || v.status === f.st)

  return (
    <>
      <div>
        <TituloPagina titulo="Minhas vendas" />
        <div className="text-[14px] text-ink-600">Vendas que o seu consultor registrou com os seus códigos. Toque para ver o detalhe.</div>
      </div>
      <AvisoPagamento />
      <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] pb-0.5 sm:mx-0 sm:px-0">
        {FILTROS.map((x) => (
          <Chip key={x.k} active={filtro === x.k} onClick={() => setFiltro(x.k)} className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px]">
            {x.label}
          </Chip>
        ))}
      </div>
      {vendas.isLoading ? (
        <Carregando />
      ) : vendas.error ? (
        <ErroBox erro={vendas.error} onRetry={() => vendas.refetch()} />
      ) : itens.length ? (
        <Card className="overflow-hidden">
          {itens.map((v) => (
            <LinhaVenda key={v.venda_id} v={v} onClick={() => setAberta(v)} />
          ))}
        </Card>
      ) : (
        <Vazio titulo="Nada por aqui" texto={filtro === 'todos' ? 'As vendas aparecem aqui quando o consultor registrar um cliente que veio pelo seu QR Code.' : 'Nenhuma venda com esse status.'} />
      )}
      <SeloLGPD />
      <Modal aberto={!!aberta} onFechar={() => setAberta(null)} titulo="Detalhe da venda">
        {aberta && <DetalheVenda v={aberta} config={config.data} />}
      </Modal>
    </>
  )
}
