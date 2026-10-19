import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, painelDe } from '@/auth/AuthProvider'
import type { Papel } from '@/lib/types'
import { Carregando } from '@/components/ui/feedback'

export function RequireRole({ papel, children }: { papel: Papel; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()

  if (loading || (session && !profile)) return <Carregando tela />
  if (!session || !profile) return <Navigate to={`/entrar?voltar=${encodeURIComponent(loc.pathname)}`} replace />
  if (profile.papel !== papel) return <Navigate to={painelDe(profile.papel)} replace />
  return <>{children}</>
}
