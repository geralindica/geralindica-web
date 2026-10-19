import { useId } from 'react'

/** check_circle preenchido (Material) — o check é vazado e mostra o fundo. */
export function CheckCircleFilled({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <circle cx="12" cy="12" r="10" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}
