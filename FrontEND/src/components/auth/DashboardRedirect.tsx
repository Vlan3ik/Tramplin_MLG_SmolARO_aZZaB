import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getDefaultRouteForRole } from '../../utils/auth'

export function DashboardRedirect() {
  const { session } = useAuth()

  return <Navigate to={getDefaultRouteForRole(session?.platformRole ?? null)} replace />
}
