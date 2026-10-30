import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Headset } from 'lucide-react'
import { usePerfil } from '@/auth/AuthProvider'
import { brl } from '@/lib/utils'
import { primeiroNome } from '@/lib/negocio'
import type { VendaIndicador } from '@/lib/types'
import { useConfig } from '@/data/queries'
import { CheckCircleFilled } from '@/components/icons'
import { BarraFunil, Card, DetalheVenda, LinhaVenda } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { totaisVendas, useFunil, useMeuVinculo, useVendas } from './dados'

export function Inicio() {
  const p = usePerfil()
  const vendas = useVendas()
  const config = useConfig()
  const funil = useFunil()
  const vinculo = useMeuVinculo()
  const [aberta, setAberta] = useState<VendaIndicador | null>(null)
  const t = totaisVendas(vendas.data)
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <>
      <div>
        <div className="text-[14px] font-semibold text-ink-600">Olá, {primeiroNome(p.nome)}</div>
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.025em]">Seu resumo de {mes}</h1>
      </div>

      {vinculo.data && !vinculo.data.consultor_id && (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-ambar-bg px-4 py-3.5 text-[14px] font-semibold text-ambar-fg">
          <Headset size={20} />
          <span className="flex-1">Você ainda não tem consultor. Escolha um pela temperatura para seus QR Codes começarem a levar clientes até ele.</span>
          <Link to="/indicador/consultor" className={buttonVariants({ variant: 'dark', size: 'sm' })}>
            Escolher consultor
          </Link>
        </div>
      )}

      {vendas.error ? (
        <ErroBox erro={vendas.error} onRetry={() => vendas.refetch()} />
      ) : (
        <div className="flex flex-col gap-[18px] rounded-[24px] bg-ink-950 p-6 text-white">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-verde-200">Você deve receber do seu consultor (estimativa)</span>
            <span className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[44px]">{vendas.isLoading ? '…' : brl(t.aprovado + t.aguardando)}</span>
          </div>
          <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
            <div className="bg-verde-300" style={{ flex: t.aprovado || 0.001 }} />
            <div className="bg-ambar-solid" style={{ flex: t.aguardando || 0.001 }} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-2xl bg-verde-600 p-3.5 text-white">
              <span className="flex items-center gap-1 text-[12px] font-bold">
                <CheckCircleFilled size={15} />
                Aprovadas · Verdinho
              </span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">{brl(t.aprovado)}</span>
              <span className="text-[12px] font-semibold text-verde-100">O consultor faz o Pix</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-ink-800 p-3.5">
              <span className="flex items-center gap-1 text-[12px] font-bold text-[#F6C35B]">
                <Clock size={14} strokeWidth={2.6} />
                Aguardando entrevista
              </span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">{brl(t.aguardando)}</span>
              <span className="text-[12px] font-semibold text-ink-400">Entrevista de saúde</span>
            </div>
          </div>
          <div className="border-t border-ink-800 pt-3.5 text-[12px] leading-[1.5] text-ink-400">
            Valores só informativos. A Geralindica não recebe nem repassa dinheiro: quem paga é o seu consultor, por Pix.
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-3.5 rounded-[20px] p-5">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">Seu funil</span>
          <span className="text-[12px] font-semibold text-ink-600">desde o início</span>
        </div>
        {funil.isLoading ? (
          <Carregando />
        ) : funil.error ? (
          <ErroBox erro={funil.error} />
        ) : (
          <>
            <BarraFunil label="Escaneamentos" n={funil.data!.escaneamentos} total={funil.data!.escaneamentos} color="#1F2E45" />
            <BarraFunil label="Conversas no WhatsApp" n={funil.data!.conversas} total={funil.data!.escaneamentos} color="#3B7BE8" />
            <BarraFunil label="Cotações" n={funil.data!.cotacoes} total={funil.data!.escaneamentos} color="#3B7BE8" />
            <BarraFunil label="Vendas fechadas" n={funil.data!.fechados} total={funil.data!.escaneamentos} color="#F2A516" />
            <BarraFunil label="Aprovados (Verdinho)" n={funil.data!.aprovados} total={funil.data!.escaneamentos} color="#0F9D58" />
          </>
        )}
      </Card>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">Últimas vendas</span>
          <Link to="/indicador/extrato" className="text-[13px] font-bold text-verde-700">
            Ver todas
          </Link>
        </div>
        {vendas.isLoading ? (
          <Carregando />
        ) : vendas.data?.length ? (
          <Card className="overflow-hidden">
            {vendas.data.slice(0, 3).map((v) => (
              <LinhaVenda key={v.venda_id} v={v} onClick={() => setAberta(v)} mostrarCanal />
            ))}
          </Card>
        ) : (
          <Vazio titulo="Nenhuma venda ainda" texto="Quando o consultor registrar a venda de um cliente que escaneou seu QR Code, ela aparece aqui.">
            <Link to="/indicador/qr" className={buttonVariants({ variant: 'primary', size: 'sm', className: 'mt-2' })}>
              Ver meus QR Codes <ArrowRight size={16} />
            </Link>
          </Vazio>
        )}
      </div>

      <Modal aberto={!!aberta} onFechar={() => setAberta(null)} titulo="Detalhe da venda">
        {aberta && <DetalheVenda v={aberta} config={config.data} />}
      </Modal>
    </>
  )
}
