import { Suspense, useEffect, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar } from '@/components/painel/comum'
import { Carregando } from '@/components/ui/feedback'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'

export type NavItem = { to: string; label: string; short?: string; icon: LucideIcon; badge?: string | number; end?: boolean }

type Props = {
  nav: NavItem[]
  subtitulo: string
  papelLabel: string
  foto?: string | null
  escuro?: boolean
  barraInferior?: boolean
  rodapeExtra?: ReactNode
  largura?: number
}

export function PainelLayout({ nav, subtitulo, papelLabel, foto, escuro, barraInferior, rodapeExtra, largura = 1320 }: Props) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const nome = profile?.nome ?? ''

  const itemCls = (ativo: boolean) =>
    cn(
      'flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[14px] transition-colors',
      escuro
        ? ativo
          ? 'bg-ink-800 font-bold text-white'
          : 'font-semibold text-[#98A6B8] hover:bg-ink-800/60'
        : ativo
          ? 'bg-verde-50 font-bold text-verde-900'
          : 'font-semibold text-ink-600 hover:bg-ink-50',
    )

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 px-[14px] py-5 lg:flex',
          escuro ? 'bg-ink-950 text-white' : 'border-r border-ink-200 bg-white',
        )}
      >
        <Link to="/" className="px-2.5 pt-1" aria-label="Site da Geralindica">
          <Logo className={cn('text-[22px]', escuro && 'text-white')} />
        </Link>
        <span className="px-2.5 pb-4 text-[11px] font-bold uppercase tracking-[.08em] text-ink-400">{subtitulo}</span>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => itemCls(isActive)}>
              {({ isActive }) => (
                <>
                  <n.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="flex-1">{n.label}</span>
                  {n.badge ? <span className="rounded-full bg-ink-950 px-[7px] py-px text-[11px] font-extrabold text-white">{n.badge}</span> : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          {rodapeExtra}
          <div className={cn('flex items-center gap-2.5 border-t px-1 pt-3.5', escuro ? 'border-ink-800' : 'border-ink-100')}>
            <Avatar nome={nome} foto={foto} size={36} className={escuro ? 'bg-ink-800' : undefined} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-bold">{nome}</span>
              <span className="truncate text-[12px] text-ink-400">{papelLabel}</span>
            </div>
            <button type="button" onClick={signOut} title="Sair" aria-label="Sair" className="cursor-pointer rounded-lg p-1.5 text-ink-400 hover:text-vermelho-fg">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo no celular / tablet */}
        <header className={cn('sticky top-0 z-30 lg:hidden', escuro ? 'bg-ink-950 text-white' : 'border-b border-ink-200 bg-white/95 backdrop-blur')}>
          <div className="flex items-center gap-3 px-[18px] py-3">
            <Link to="/" aria-label="Site da Geralindica">
              <Logo className={cn('text-[22px]', escuro && 'text-white')} />
            </Link>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] text-ink-400">{subtitulo}</span>
            <button type="button" onClick={signOut} className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-bold text-ink-400">
              <LogOut size={17} />
              Sair
            </button>
          </div>
          {!barraInferior && (
            <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => cn(itemCls(isActive), 'shrink-0 gap-2 py-2 text-[13px]')}
                >
                  <n.icon size={17} />
                  {n.short ?? n.label}
                </NavLink>
              ))}
            </nav>
          )}
        </header>

        <main className={cn('flex-1 px-[18px] py-5 sm:px-6 lg:px-10 lg:py-8', barraInferior && 'pb-28 lg:pb-8')}>
          <div className="mx-auto flex w-full flex-col gap-5" style={{ maxWidth: largura }}>
            <Suspense fallback={<Carregando />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {barraInferior && (
          <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-ink-200 bg-white px-1.5 pb-[max(14px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-bold', isActive ? 'text-verde-700' : 'text-ink-400')}
              >
                {({ isActive }) => (
                  <>
                    <n.icon size={23} strokeWidth={isActive ? 2.4 : 1.9} />
                    {n.short ?? n.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
