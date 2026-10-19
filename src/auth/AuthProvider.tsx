import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Papel, Profile } from '@/lib/types'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function painelDe(papel: Papel) {
  return papel === 'admin' ? '/admin' : papel === 'consultor' ? '/consultor' : '/indicador'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSession(data.session)
      await loadProfile(data.session)
      if (ativo) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      if (evento === 'SIGNED_OUT') {
        setProfile(null)
        qc.clear()
      }
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') {
        // fora do callback para não travar o cliente de auth
        setTimeout(() => loadProfile(s), 0)
      }
    })
    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, qc])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: () => loadProfile(session),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, profile, loading, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

/** Perfil garantido dentro das áreas protegidas. */
export function usePerfil(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('Perfil não carregado')
  return profile
}
