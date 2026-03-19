import { Navigate } from 'react-router-dom'
import { getDefaultRouteForRole, loadAuthSession } from '../../utils/auth'

export function DashboardRedirect() {
  const session = loadAuthSession()

  return <Navigate to={getDefaultRouteForRole(session?.platformRole ?? null)} replace />
}
