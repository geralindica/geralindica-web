import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string }

export function Field({ label, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold">
      {label}
      <input
        className={cn(
          'h-12 rounded-[12px] border border-ink-200 bg-white px-[14px] text-[15px] font-medium text-ink-950 outline-none transition-shadow placeholder:text-ink-400 focus:border-verde-500 focus:ring-[3px] focus:ring-verde-500/20',
          className,
        )}
        {...props}
      />
    </label>
  )
}

type ChipProps = {
  active: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}

/** Chip de filtro / opção: preenchido em ink-950 quando ativo. */
export function Chip({ active, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer border font-bold transition-colors',
        active ? 'border-ink-950 bg-ink-950 text-white' : 'border-ink-200 bg-white text-ink-950 hover:border-ink-400',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-[13px] font-bold uppercase tracking-[.08em] text-verde-700', className)}>{children}</span>
}
