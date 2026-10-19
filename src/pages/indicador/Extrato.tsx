import { useState } from 'react'
import type { ExtratoItem, StatusTx } from '@/lib/types'
import { Chip } from '@/components/ui/form'
import { Card, LinhaExtrato, ReciboSplit, SeloLGPD, TituloPagina } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio } from '@/components/ui/feedback'
import { useExtrato } from './dados'

const FILTROS: { k: string; label: string; st: StatusTx[] | null }[] = [
  { k: 'todos', label: 'Todos', st: null },
  { k: 'verdinho', label: 'Verdinho', st: ['verdinho', 'repassado'] },
  { k: 'custodia', label: 'Em custódia', st: ['custodia'] },
  { k: 'pendente', label: 'Pendente', st: ['pendente'] },
  { k: 'estornado', label: 'Estornado', st: ['estornado'] },
]

export function Extrato() {
  const extrato = useExtrato()
  const [filtro, setFiltro] = useState('todos')
  const [recibo, setRecibo] = useState<ExtratoItem | null>(null)
  const f = FILTROS.find((x) => x.k === filtro)!
  const itens = (extrato.data ?? []).filter((e) => !f.st || f.st.includes(e.status))

  return (
    <>
      <div>
        <TituloPagina titulo="Extrato" />
        <div className="text-[14px] text-ink-600">Toque em uma comissão para ver o recibo do split.</div>
      </div>
      <div className="-mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] pb-0.5 sm:mx-0 sm:px-0">
        {FILTROS.map((x) => (
          <Chip key={x.k} active={filtro === x.k} onClick={() => setFiltro(x.k)} className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px]">
            {x.label}
          </Chip>
        ))}
      </div>
      {extrato.isLoading ? (
        <Carregando />
      ) : extrato.error ? (
        <ErroBox erro={extrato.error} onRetry={() => extrato.refetch()} />
      ) : itens.length ? (
        <Card className="overflow-hidden">
          {itens.map((e) => (
            <LinhaExtrato key={e.transacao_id} e={e} onClick={() => setRecibo(e)} />
          ))}
        </Card>
      ) : (
        <Vazio titulo="Nada por aqui" texto={filtro === 'todos' ? 'Suas comissões aparecem aqui assim que um cliente fechar contrato.' : 'Nenhuma comissão com esse status.'} />
      )}
      <SeloLGPD />
      <Modal aberto={!!recibo} onFechar={() => setRecibo(null)} titulo="Recibo do split">
        {recibo && <ReciboSplit e={recibo} />}
      </Modal>
    </>
  )
}
