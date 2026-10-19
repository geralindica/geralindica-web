import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Headset, Lock } from 'lucide-react'
import { usePerfil } from '@/auth/AuthProvider'
import { brl } from '@/lib/utils'
import { primeiroNome } from '@/lib/negocio'
import type { ExtratoItem } from '@/lib/types'
import { CheckCircleFilled } from '@/components/icons'
import { BarraFunil, Card, LinhaExtrato, ReciboSplit } from '@/components/painel/comum'
import { Carregando, ErroBox, Modal, Vazio } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { totaisExtrato, useExtrato, useFunil, useMeuVinculo } from './dados'

export function Inicio() {
  const p = usePerfil()
  const extrato = useExtrato()
  const funil = useFunil()
  const vinculo = useMeuVinculo()
  const [recibo, setRecibo] = useState<ExtratoItem | null>(null)
  const t = totaisExtrato(extrato.data)
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
          <span className="flex-1">Você ainda não tem consultor. Escolha um para seus QR Codes começarem a gerar comissão.</span>
          <Link to="/indicador/consultor" className={buttonVariants({ variant: 'dark', size: 'sm' })}>
            Escolher consultor
          </Link>
        </div>
      )}

      {extrato.error ? (
        <ErroBox erro={extrato.error} onRetry={() => extrato.refetch()} />
      ) : (
        <div className="flex flex-col gap-[18px] rounded-[24px] bg-ink-950 p-6 text-white">
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold text-verde-200">Você tem a receber</span>
            <span className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.045em] sm:text-[44px]">{extrato.isLoading ? '…' : brl(t.liberado + t.custodia)}</span>
          </div>
          <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
            <div className="bg-verde-300" style={{ flex: t.liberado || 0.001 }} />
            <div className="bg-ambar-solid" style={{ flex: t.custodia || 0.001 }} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Link to="/indicador/saques" className="flex flex-col gap-1 rounded-2xl bg-verde-600 p-3.5 text-white hover:bg-verde-700">
              <span className="flex items-center gap-1 text-[12px] font-bold">
                <CheckCircleFilled size={15} />
                Liberado · Verdinho
              </span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">{brl(t.liberado)}</span>
              <span className="text-[12px] font-semibold text-verde-100">Sacar via Pix →</span>
            </Link>
            <div className="flex flex-col gap-1 rounded-2xl bg-ink-800 p-3.5">
              <span className="flex items-center gap-1 text-[12px] font-bold text-[#F6C35B]">
                <Lock size={14} strokeWidth={2.6} />
                Em custódia
              </span>
              <span className="text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">{brl(t.custodia)}</span>
              <span className="text-[12px] font-semibold text-ink-400">Aguardando entrevista</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-ink-800 pt-3.5 text-[13px] text-ink-400">
            <span>Já pago (total)</span>
            <span className="font-bold text-white">{brl(t.pago)}</span>
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
            <BarraFunil label="Escaneamentos" n={funil.data!.escaneamentos} total={funil.data!.escaneamentos} color="#24302C" />
            <BarraFunil label="Conversas no WhatsApp" n={funil.data!.conversas} total={funil.data!.escaneamentos} color="#3B7BE8" />
            <BarraFunil label="Cotações enviadas" n={funil.data!.cotacoes} total={funil.data!.escaneamentos} color="#3B7BE8" />
            <BarraFunil label="Fechados" n={funil.data!.fechados} total={funil.data!.escaneamentos} color="#F2A516" />
            <BarraFunil label="Aprovados (Verdinho)" n={funil.data!.aprovados} total={funil.data!.escaneamentos} color="#0F9D58" />
          </>
        )}
      </Card>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-extrabold">Últimas comissões</span>
          <Link to="/indicador/extrato" className="text-[13px] font-bold text-verde-700">
            Ver extrato
          </Link>
        </div>
        {extrato.isLoading ? (
          <Carregando />
        ) : extrato.data?.length ? (
          <Card className="overflow-hidden">
            {extrato.data.slice(0, 3).map((e) => (
              <LinhaExtrato key={e.transacao_id} e={e} onClick={() => setRecibo(e)} mostrarCanal />
            ))}
          </Card>
        ) : (
          <Vazio titulo="Nenhuma comissão ainda" texto="Assim que um cliente que escaneou seu QR Code fechar o plano, a comissão aparece aqui.">
            <Link to="/indicador/qr" className={buttonVariants({ variant: 'primary', size: 'sm', className: 'mt-2' })}>
              Ver meus QR Codes <ArrowRight size={16} />
            </Link>
          </Vazio>
        )}
      </div>

      <Modal aberto={!!recibo} onFechar={() => setRecibo(null)} titulo="Recibo do split">
        {recibo && <ReciboSplit e={recibo} />}
      </Modal>
    </>
  )
}
