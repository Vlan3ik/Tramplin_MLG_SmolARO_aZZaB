import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getDefaultRouteForRole } from '../../utils/auth'

export function GuestOnlyRoute() {
  const { isAuthenticated, session } = useAuth()

  if (isAuthenticated) {
    return <Navigate to={getDefaultRouteForRole(session?.platformRole ?? null)} replace />
  }

  return <Outlet />
}
