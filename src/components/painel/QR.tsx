import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

/** QR Code real (SVG) apontando para o link rastreado do canal. */
export function QR({ texto, size = 96, className }: { texto: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let ok = true
    QRCode.toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0B1A30', light: '#FFFFFF00' } }).then((s) => ok && setSvg(s))
    return () => {
      ok = false
    }
  }, [texto])
  return <div className={cn('[&>svg]:block [&>svg]:size-full', className)} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR Code para ${texto}`} role="img" />
}
