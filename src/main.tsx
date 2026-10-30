import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireRole } from '@/auth/RequireRole'
import { Carregando, ToastProvider } from '@/components/ui/feedback'
import { Layout } from '@/components/Layout'
import { Landing } from '@/pages/Landing'
import { Vitrine } from '@/pages/Vitrine'
import { Perfil } from '@/pages/Perfil'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { RedefinirSenha } from '@/pages/RedefinirSenha'
import { QrRedirect } from '@/pages/QrRedirect'
import { Legal } from '@/pages/Legal'
import './index.css'

// Painéis carregados sob demanda: o site público não baixa o código das áreas logadas.
const IndicadorLayout = lazy(() => import('@/pages/indicador/IndicadorLayout').then((m) => ({ default: m.IndicadorLayout })))
const Inicio = lazy(() => import('@/pages/indicador/Inicio').then((m) => ({ default: m.Inicio })))
const QrCodes = lazy(() => import('@/pages/indicador/QrCodes').then((m) => ({ default: m.QrCodes })))
const Extrato = lazy(() => import('@/pages/indicador/Extrato').then((m) => ({ default: m.Extrato })))
const MeuConsultor = lazy(() => import('@/pages/indicador/MeuConsultor').then((m) => ({ default: m.MeuConsultor })))
const MeusDados = lazy(() => import('@/pages/indicador/MeusDados').then((m) => ({ default: m.MeusDados })))
const ConsultorLayout = lazy(() => import('@/pages/consultor/ConsultorLayout').then((m) => ({ default: m.ConsultorLayout })))
const Dashboard = lazy(() => import('@/pages/consultor/Dashboard').then((m) => ({ default: m.Dashboard })))
const Leads = lazy(() => import('@/pages/consultor/Leads').then((m) => ({ default: m.Leads })))
const LeadDetalhe = lazy(() => import('@/pages/consultor/LeadDetalhe').then((m) => ({ default: m.LeadDetalhe })))
const MeusIndicadores = lazy(() => import('@/pages/consultor/MeusIndicadores').then((m) => ({ default: m.MeusIndicadores })))
const PerfilPublico = lazy(() => import('@/pages/consultor/PerfilPublico').then((m) => ({ default: m.PerfilPublico })))
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const Vendas = lazy(() => import('@/pages/admin/Vendas').then((m) => ({ default: m.Vendas })))
const Split = lazy(() => import('@/pages/admin/Split').then((m) => ({ default: m.Split })))
const Usuarios = lazy(() => import('@/pages/admin/Usuarios').then((m) => ({ default: m.Usuarios })))
const Catalogo = lazy(() => import('@/pages/admin/Catalogo').then((m) => ({ default: m.Catalogo })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Carregando tela />}>
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
                <Route path="dados" element={<MeusDados />} />
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
                <Route index element={<Vendas />} />
                <Route path="split" element={<Split />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="catalogo" element={<Catalogo />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
