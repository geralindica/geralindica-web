// Gera as artes de divulgação (PNG pronto para gráfica/Instagram) com o QR Code real do canal.
import QRCode from 'qrcode'
import { MARCA } from '@/lib/marca'

export type TipoArte = 'encosto' | 'cartao' | 'story'

const VERDE = '#0F9D58'
const INK = '#0B2A66'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function textoQuebrado(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, larguraMax: number, altura: number, alinhar: CanvasTextAlign) {
  ctx.textAlign = alinhar
  const palavras = texto.split(' ')
  let linha = ''
  let yy = y
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (ctx.measureText(teste).width > larguraMax && linha) {
      ctx.fillText(linha, x, yy)
      linha = p
      yy += altura
    } else linha = teste
  }
  if (linha) ctx.fillText(linha, x, yy)
  return yy + altura
}

// Logo oficial (public/logo.png, o mesmo do site) numa etiqueta branca, porque o fundo das artes é verde.
let logoImg: Promise<HTMLImageElement> | undefined
function carregarLogo() {
  logoImg ??= new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('Não foi possível carregar a logo'))
    img.src = MARCA.logo
  })
  return logoImg
}

async function logo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alinhar: 'center' | 'left' = 'center') {
  const img = await carregarLogo()
  const h = size * 1.1
  const w = (img.width / img.height) * h
  const pad = size * 0.45
  const x0 = alinhar === 'center' ? x - w / 2 : x + pad
  const topo = y - h
  ctx.fillStyle = '#fff'
  roundRect(ctx, x0 - pad, topo - pad * 0.7, w + pad * 2, h + pad * 1.4, (h + pad * 1.4) / 2)
  ctx.fill()
  ctx.drawImage(img, x0, topo, w, h)
}

async function qrCanvas(link: string, px: number) {
  const c = document.createElement('canvas')
  await QRCode.toCanvas(c, link, { width: px, margin: 0, errorCorrectionLevel: 'M', color: { dark: INK, light: '#FFFFFF' } })
  return c
}

export async function gerarArte(tipo: TipoArte, link: string, rotulo: string, codigo: string): Promise<Blob> {
  await document.fonts?.ready
  const dims = { encosto: [1200, 1600], cartao: [1050, 600], story: [1080, 1920] }[tipo]
  const [W, H] = dims
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!

  ctx.fillStyle = VERDE
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'

  if (tipo === 'cartao') {
    ctx.font = '800 64px Manrope, system-ui, sans-serif'
    const y = textoQuebrado(ctx, 'Plano de saúde sem fila de corretor', 70, 150, 520, 74, 'left')
    ctx.font = '600 30px Manrope, system-ui, sans-serif'
    ctx.globalAlpha = 0.92
    textoQuebrado(ctx, 'Aponte a câmera e receba sua cotação no WhatsApp.', 70, y + 20, 500, 40, 'left')
    ctx.globalAlpha = 1
    await logo(ctx, 70, H - 70, 44, 'left')
    const q = 380
    ctx.fillStyle = '#fff'
    roundRect(ctx, W - q - 110, (H - q) / 2 - 40, q + 40, q + 40, 28)
    ctx.fill()
    ctx.drawImage(await qrCanvas(link, q), W - q - 90, (H - q) / 2 - 20)
    ctx.fillStyle = '#fff'
    ctx.font = '600 24px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${rotulo} · ${codigo}`, W - q / 2 - 90, (H + q) / 2 + 60)
  } else {
    const story = tipo === 'story'
    const q = story ? 620 : 640
    ctx.font = `800 ${story ? 96 : 92}px Manrope, system-ui, sans-serif`
    const yTitulo = textoQuebrado(ctx, 'Plano de saúde sem fila de corretor', W / 2, story ? 330 : 190, W - 200, story ? 108 : 104, 'center')
    const yQR = yTitulo + (story ? 60 : 20)
    ctx.fillStyle = '#fff'
    roundRect(ctx, (W - q) / 2 - 36, yQR, q + 72, q + 72, 44)
    ctx.fill()
    ctx.drawImage(await qrCanvas(link, q), (W - q) / 2, yQR + 36)
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${story ? 46 : 42}px Manrope, system-ui, sans-serif`
    ctx.globalAlpha = 0.95
    textoQuebrado(ctx, 'Aponte a câmera e receba sua cotação no WhatsApp', W / 2, yQR + q + 72 + (story ? 110 : 90), W - 240, story ? 58 : 54, 'center')
    ctx.globalAlpha = 1
    ctx.font = '600 30px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${rotulo} · ${codigo}`, W / 2, H - (story ? 240 : 150))
    await logo(ctx, W / 2, H - (story ? 140 : 70), story ? 60 : 50)
  }

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), 'image/png'))
}

export async function baixarArte(tipo: TipoArte, link: string, rotulo: string, codigo: string) {
  const blob = await gerarArte(tipo, link, rotulo, codigo)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `geralindica-${rotulo.toLowerCase().replace(/\s+/g, '-')}-${tipo}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
