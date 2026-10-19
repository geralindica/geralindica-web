import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { buttonVariants } from '@/components/ui/button'
import { painelDe, useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'

/** Volta ao topo em cada troca de página; com #hash, rola até a âncora. */
function ScrollManager() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, search, hash])
  return null
}

const navItem = 'rounded-[10px] px-3 py-2 text-[14px] font-semibold text-ink-600 transition-colors hover:bg-ink-100'

function Header() {
  const { profile } = useAuth()
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200 bg-[rgba(245,247,246,.88)] backdrop-blur-[12px]">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-[14px] sm:gap-7 sm:px-7">
        <Link to="/" aria-label="Indikei, página inicial">
          <Logo />
        </Link>
        <nav className="hidden flex-wrap gap-1 lg:flex">
          <Link to="/#como-funciona" className={navItem}>
            Como funciona
          </Link>
          <NavLink to="/consultores" className={({ isActive }) => cn(navItem, isActive && 'bg-ink-100 text-ink-950')}>
            Consultores
          </NavLink>
          <Link to="/cadastro?papel=consultor" className={navItem}>
            Sou consultor
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {profile ? (
            <Link to={painelDe(profile.papel)} className={buttonVariants({ variant: 'dark', size: 'sm' })}>
              <LayoutDashboard size={17} />
              Meu painel
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="px-[14px] py-[10px] text-[14px] font-bold text-ink-950">
                Entrar
              </Link>
              <Link to="/cadastro?papel=indicador" className={buttonVariants({ variant: 'dark', size: 'sm' })}>
                Começar a indicar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-ink-200 bg-white">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-6 px-7 py-8 text-[13px] text-ink-600">
        <Logo small />
        <span>© 2026 Indikei Tecnologia Ltda.</span>
        <div className="flex gap-4 sm:ml-auto">
          <Link to="/termos" className="hover:text-ink-950">
            Termos
          </Link>
          <Link to="/privacidade" className="hover:text-ink-950">
            Privacidade (LGPD)
          </Link>
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <ScrollManager />
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
