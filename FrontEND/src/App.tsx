import { Route, Routes } from 'react-router-dom'
import { DashboardRedirect } from './components/auth/DashboardRedirect'
import { GuestOnlyRoute } from './components/auth/GuestOnlyRoute'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ChatWidget } from './components/chat/ChatWidget'
import { PublicLayout } from './components/layout/PublicLayout'
import { AboutPlatformPage } from './pages/AboutPlatformPage'
import { CompaniesListPage } from './pages/CompaniesListPage'
import { CompanyPage } from './pages/CompanyPage'
import { EmployerVerificationPage } from './pages/EmployerVerificationPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OpportunityDetailsPage } from './pages/OpportunityDetailsPage'
import { RegisterPage } from './pages/RegisterPage'
import { VacancyFlowPage } from './pages/VacancyFlowPage'
import { CuratorDashboardPage } from './pages/dashboards/CuratorDashboardPage'
import { EmployerDashboardPage } from './pages/dashboards/EmployerDashboardPage'
import { SeekerDashboardPage } from './pages/dashboards/SeekerDashboardPage'
import { PlatformRole } from './types/auth'

function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPlatformPage />} />
          <Route path="opportunity/:id" element={<OpportunityDetailsPage />} />
          <Route path="companies" element={<CompaniesListPage />} />
          <Route path="company/:id" element={<CompanyPage />} />
          <Route path="vacancy-flow" element={<VacancyFlowPage />} />
          <Route path="vacancy-flow/:step" element={<VacancyFlowPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<GuestOnlyRoute />}>
          <Route path="register" element={<RegisterPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Employer]} />}>
          <Route path="verification/employer" element={<EmployerVerificationPage />} />
          <Route path="dashboard/employer" element={<EmployerDashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Seeker]} />}>
          <Route path="dashboard/seeker" element={<SeekerDashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Curator]} />}>
          <Route path="dashboard/curator" element={<CuratorDashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardRedirect />} />
        </Route>
      </Routes>
      <ChatWidget />
    </>
  )
}

export default App

