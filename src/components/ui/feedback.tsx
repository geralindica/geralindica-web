import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------- Toasts ----------
type Toast = { id: number; tipo: 'ok' | 'erro'; texto: string }
const ToastCtx = createContext<(texto: string, tipo?: Toast['tipo']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const push = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, tipo, texto }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === 'erro' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-[480px] items-start gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-dark',
              t.tipo === 'erro' ? 'bg-vermelho-fg text-white' : 'bg-ink-950 text-white',
            )}
          >
            {t.tipo === 'erro' ? <AlertCircle size={18} className="mt-px shrink-0" /> : <CheckCircle2 size={18} className="mt-px shrink-0 text-verde-300" />}
            {t.texto}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

// ---------- Estados de carregamento / vazio / erro ----------
export function Carregando({ tela, texto = 'Carregando…' }: { tela?: boolean; texto?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-[14px] font-semibold text-ink-600', tela ? 'min-h-[60vh]' : 'py-10')} role="status">
      <Loader2 size={18} className="animate-spin" />
      {texto}
    </div>
  )
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
      <div className="text-[16px] font-extrabold">{titulo}</div>
      {texto && <p className="m-0 max-w-[420px] text-[14px] leading-[1.5] text-ink-600">{texto}</p>}
      {children}
    </div>
  )
}

export function ErroBox({ erro, onRetry }: { erro: unknown; onRetry?: () => void }) {
  const msg = erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : 'Não foi possível carregar.'
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-vermelho-bg px-4 py-3 text-[14px] font-semibold text-vermelho-fg" role="alert">
      <AlertCircle size={18} />
      <span className="flex-1">{msg}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="cursor-pointer rounded-[10px] border border-vermelho-fg/30 bg-white px-3 py-1.5 text-[13px] font-bold">
          Tentar de novo
        </button>
      )}
    </div>
  )
}

// ---------- Modal / Sheet ----------
export function Modal({
  aberto,
  onFechar,
  titulo,
  children,
  largura = 440,
  sheetNoMobile = true,
}: {
  aberto: boolean
  onFechar: () => void
  titulo: string
  children: ReactNode
  largura?: number
  sheetNoMobile?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div
      className={cn('fixed inset-0 z-50 flex justify-center bg-[rgba(11,26,48,.45)]', sheetNoMobile ? 'items-end sm:items-center sm:p-6' : 'items-center p-4 sm:p-6')}
      onClick={onFechar}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: largura }}
        className={cn(
          'flex max-h-[92vh] w-full flex-col gap-[14px] overflow-y-auto bg-white p-[22px] outline-none',
          sheetNoMobile ? 'rounded-t-[24px] sm:rounded-[24px]' : 'rounded-[24px]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[18px] font-extrabold">{titulo}</span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="cursor-pointer rounded-full p-1 text-ink-600 hover:bg-ink-100">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
