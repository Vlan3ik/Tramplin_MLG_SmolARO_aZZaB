import { Navigate, Route, Routes } from 'react-router-dom'
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

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="opportunity/:id" element={<OpportunityDetailsPage />} />
        <Route path="company/:slug" element={<CompanyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="register" element={<RegisterPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="verification/employer" element={<EmployerVerificationPage />} />
      <Route path="dashboard/seeker" element={<SeekerDashboardPage />} />
      <Route path="dashboard/employer" element={<EmployerDashboardPage />} />
      <Route path="dashboard/curator" element={<CuratorDashboardPage />} />
      <Route path="dashboard" element={<Navigate to="/dashboard/seeker" replace />} />
    </Routes>
  )
}

export default App

