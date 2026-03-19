import { Navigate, Outlet } from 'react-router-dom'
import { getDefaultRouteForRole, hasActiveSession, loadAuthSession } from '../../utils/auth'

export function GuestOnlyRoute() {
  const session = loadAuthSession()

  if (hasActiveSession(session)) {
    return <Navigate to={getDefaultRouteForRole(session?.platformRole ?? null)} replace />
  }

  return <Outlet />
}
