import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { PlatformRole } from '../../types/auth'
import { getDefaultRouteForRole, hasActiveSession, loadAuthSession } from '../../utils/auth'

type ProtectedRouteProps = {
  allowedRoles?: PlatformRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const session = loadAuthSession()

  if (!hasActiveSession(session)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const currentRole = session?.platformRole ?? null

  if (allowedRoles?.length && (!currentRole || !allowedRoles.includes(currentRole))) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />
  }

  return <Outlet />
}
