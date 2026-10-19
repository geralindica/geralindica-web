import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        dark: 'bg-ink-950 text-white hover:bg-ink-800',
        primary: 'bg-verde-600 text-white hover:bg-verde-700',
        outline: 'border border-ink-200 bg-white text-ink-950 hover:border-ink-950',
        light: 'bg-white text-verde-900 hover:bg-verde-50',
        outlineLight: 'border border-white/50 bg-transparent text-white hover:bg-white/10',
        gov: 'bg-azul-fg text-white hover:bg-[#184A9E]',
        muted: 'bg-ink-100 text-ink-400',
      },
      size: {
        sm: 'h-[42px] rounded-[12px] px-[18px] text-[14px]',
        md: 'h-[46px] rounded-[12px] px-5 text-[15px]',
        form: 'h-12 rounded-[12px] px-5 text-[15px]',
        lg: 'h-[52px] rounded-[14px] px-[26px] text-[16px]',
        xl: 'h-[54px] rounded-[14px] px-6 text-[16px] font-extrabold',
      },
    },
    defaultVariants: { variant: 'dark', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = 'Button'
