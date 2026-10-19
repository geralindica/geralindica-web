import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireRole } from '@/auth/RequireRole'
import { ToastProvider } from '@/components/ui/feedback'
import { Layout } from '@/components/Layout'
import { Landing } from '@/pages/Landing'
import { Vitrine } from '@/pages/Vitrine'
import { Perfil } from '@/pages/Perfil'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { RedefinirSenha } from '@/pages/RedefinirSenha'
import { QrRedirect } from '@/pages/QrRedirect'
import { Legal } from '@/pages/Legal'
import { IndicadorLayout } from '@/pages/indicador/IndicadorLayout'
import { Inicio } from '@/pages/indicador/Inicio'
import { QrCodes } from '@/pages/indicador/QrCodes'
import { Extrato } from '@/pages/indicador/Extrato'
import { MeuConsultor } from '@/pages/indicador/MeuConsultor'
import { Saques } from '@/pages/indicador/Saques'
import { ConsultorLayout } from '@/pages/consultor/ConsultorLayout'
import { Dashboard } from '@/pages/consultor/Dashboard'
import { Leads } from '@/pages/consultor/Leads'
import { LeadDetalhe } from '@/pages/consultor/LeadDetalhe'
import { MeusIndicadores } from '@/pages/consultor/MeusIndicadores'
import { PerfilPublico } from '@/pages/consultor/PerfilPublico'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { Financeiro } from '@/pages/admin/Financeiro'
import { Split } from '@/pages/admin/Split'
import { Usuarios } from '@/pages/admin/Usuarios'
import { Catalogo } from '@/pages/admin/Catalogo'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="q/:codigo" element={<QrRedirect />} />
              <Route element={<Layout />}>
                <Route index element={<Landing />} />
                <Route path="consultores" element={<Vitrine />} />
                <Route path="consultores/:id" element={<Perfil />} />
                <Route path="entrar" element={<Login />} />
                <Route path="cadastro" element={<Cadastro />} />
                <Route path="redefinir-senha" element={<RedefinirSenha />} />
                <Route path="termos" element={<Legal tipo="termos" />} />
                <Route path="privacidade" element={<Legal tipo="privacidade" />} />
              </Route>
              <Route
                path="indicador"
                element={
                  <RequireRole papel="indicador">
                    <IndicadorLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Inicio />} />
                <Route path="qr" element={<QrCodes />} />
                <Route path="extrato" element={<Extrato />} />
                <Route path="consultor" element={<MeuConsultor />} />
                <Route path="saques" element={<Saques />} />
              </Route>
              <Route
                path="consultor"
                element={
                  <RequireRole papel="consultor">
                    <ConsultorLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/:id" element={<LeadDetalhe />} />
                <Route path="indicadores" element={<MeusIndicadores />} />
                <Route path="perfil" element={<PerfilPublico />} />
              </Route>
              <Route
                path="admin"
                element={
                  <RequireRole papel="admin">
                    <AdminLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Financeiro />} />
                <Route path="split" element={<Split />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="catalogo" element={<Catalogo />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
