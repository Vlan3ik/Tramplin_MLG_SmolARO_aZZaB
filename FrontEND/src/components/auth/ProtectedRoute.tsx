import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { PlatformRole } from '../../types/auth'
import { getDefaultRouteForRole } from '../../utils/auth'

type ProtectedRouteProps = {
  allowedRoles?: PlatformRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const { isAuthenticated, session } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const currentRole = session?.platformRole ?? null

  if (allowedRoles?.length && (!currentRole || !allowedRoles.includes(currentRole))) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />
  }

  return <Outlet />
}
