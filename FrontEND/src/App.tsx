import { Route, Routes } from 'react-router-dom'
import { DashboardRedirect } from './components/auth/DashboardRedirect'
import { GuestOnlyRoute } from './components/auth/GuestOnlyRoute'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PublicLayout } from './components/layout/PublicLayout'
import { CompanyPage } from './pages/CompanyPage'
import { EmployerVerificationPage } from './pages/EmployerVerificationPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OpportunityDetailsPage } from './pages/OpportunityDetailsPage'
import { RegisterPage } from './pages/RegisterPage'
import { CuratorDashboardPage } from './pages/dashboards/CuratorDashboardPage'
import { EmployerDashboardPage } from './pages/dashboards/EmployerDashboardPage'
import { SeekerDashboardPage } from './pages/dashboards/SeekerDashboardPage'
import { PlatformRole } from './types/auth'

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="opportunity/:id" element={<OpportunityDetailsPage />} />
        <Route path="company/:slug" element={<CompanyPage />} />
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
  )
}

export default App
