import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function pexelsPhoto(id: number, size = 300) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${size}&h=${size}&fit=crop`
}

/** Imposto PF descontado do valor bruto antes do split 50/50. */
export const IMPOSTO_PF = 0.275

/** Comissão do indicador: 50% do líquido (bruto − imposto). */
export function comissaoIndicador(bruto: number, imposto = IMPOSTO_PF) {
  return bruto * (1 - imposto) * 0.5
}
