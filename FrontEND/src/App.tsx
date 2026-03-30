import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { fetchSeekerSettings } from './api/me'
import { DashboardRedirect } from './components/auth/DashboardRedirect'
import { GuestOnlyRoute } from './components/auth/GuestOnlyRoute'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { ChatWidget } from './components/chat/ChatWidget'
import { PublicLayout } from './components/layout/PublicLayout'
import { useAuth } from './hooks/useAuth'
import { AboutPlatformPage } from './pages/AboutPlatformPage'
import { CompaniesListPage } from './pages/CompaniesListPage'
import { CompanyPage } from './pages/CompanyPage'
import { CompanyInviteAcceptPage } from './pages/CompanyInviteAcceptPage'
import { EmployerVerificationPage } from './pages/EmployerVerificationPage'
import { EventsPage } from './pages/EventsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OpportunityDetailsPage } from './pages/OpportunityDetailsPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResumesPage } from './pages/ResumesPage'
import { VacancyFlowPage } from './pages/VacancyFlowPage'
import { CuratorDashboardPage } from './pages/dashboards/CuratorDashboardPage'
import { CuratorCreateCompanyPage } from './pages/dashboards/CuratorCreateCompanyPage'
import { CuratorCreateOpportunityPage } from './pages/dashboards/CuratorCreateOpportunityPage'
import { CuratorCreateUserPage } from './pages/dashboards/CuratorCreateUserPage'
import { CuratorCreateVacancyPage } from './pages/dashboards/CuratorCreateVacancyPage'
import { EmployerDashboardPage } from './pages/dashboards/EmployerDashboardPage'
import { CuratorModerationPage } from './pages/dashboards/CuratorModerationPage'
import { SeekerDashboardPage } from './pages/dashboards/SeekerDashboardPage'
import { SeekerPortfolioProjectPage } from './pages/dashboards/SeekerPortfolioProjectPage'
import { SeekerResumePrintPage } from './pages/dashboards/SeekerResumePrintPage'
import { PlatformRole } from './types/auth'
import { applySeekerPrivacySettings, resetSeekerPrivacySettings } from './utils/seeker-privacy-settings'

function PortfolioLegacyRedirect() {
  const { username = '' } = useParams<{ username?: string }>()
  const normalized = username.trim()
  return <Navigate to={`/dashboard/seeker/${encodeURIComponent(normalized)}`} replace />
}

function App() {
  const { session } = useAuth()
  const location = useLocation()
  const isResumePrintPage = location.pathname.startsWith('/dashboard/seeker/resume/print')
  const isResumeEditPage = location.pathname.startsWith('/dashboard/seeker/resume/edit')
  const isResumeViewPage = location.pathname === '/resumes'
  const shouldHideChatWidget = isResumePrintPage || isResumeEditPage || isResumeViewPage

  useEffect(() => {
    if (!session?.accessToken || session.platformRole !== PlatformRole.Seeker) {
      resetSeekerPrivacySettings()
      return
    }

    const controller = new AbortController()
    void fetchSeekerSettings(controller.signal)
      .then((settings) => {
        applySeekerPrivacySettings(settings)
      })
      .catch(() => {
        // No-op: keep defaults if settings are temporarily unavailable.
      })

    return () => controller.abort()
  }, [session?.accessToken, session?.platformRole, session?.user?.id])

  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPlatformPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="resumes" element={<ResumesPage />} />
          <Route path="opportunity/:id" element={<OpportunityDetailsPage />} />
          <Route path="companies" element={<CompaniesListPage />} />
          <Route path="company/:id" element={<CompanyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="dashboard/seeker/:username" element={<SeekerDashboardPage />} />
        <Route path="dashboard/seeker/:username/project/:projectId" element={<SeekerPortfolioProjectPage />} />
        <Route path="portfolio/:username" element={<PortfolioLegacyRedirect />} />

        <Route element={<GuestOnlyRoute />}>
          <Route path="register" element={<RegisterPage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Employer]} />}>
          <Route path="verification/employer" element={<EmployerVerificationPage />} />
          <Route path="dashboard/employer" element={<EmployerDashboardPage />} />
          <Route path="company-invite/:token" element={<CompanyInviteAcceptPage />} />
          <Route path="vacancy-flow" element={<VacancyFlowPage />} />
          <Route path="vacancy-flow/:step" element={<VacancyFlowPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Seeker]} />}>
          <Route path="dashboard/seeker" element={<SeekerDashboardPage />} />
          <Route path="dashboard/seeker/project/:projectId" element={<SeekerPortfolioProjectPage />} />
          <Route path="dashboard/seeker/resume/edit" element={<SeekerDashboardPage />} />
          <Route path="dashboard/seeker/resume/print" element={<SeekerResumePrintPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[PlatformRole.Curator, PlatformRole.Admin]} />}>
          <Route path="dashboard/curator" element={<CuratorDashboardPage />} />
          <Route path="dashboard/curator/moderation" element={<CuratorModerationPage />} />
          <Route path="dashboard/curator/users/create" element={<CuratorCreateUserPage />} />
          <Route path="dashboard/curator/companies/create" element={<CuratorCreateCompanyPage />} />
          <Route path="dashboard/curator/opportunities/create" element={<CuratorCreateOpportunityPage />} />
          <Route path="dashboard/curator/vacancies/create" element={<CuratorCreateVacancyPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardRedirect />} />
        </Route>
      </Routes>
      {!shouldHideChatWidget ? <ChatWidget /> : null}
    </>
  )
}

export default App

