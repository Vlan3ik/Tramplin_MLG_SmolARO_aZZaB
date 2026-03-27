import { PlatformRole, type AuthResponse, type AuthSession } from '../types/auth'

const AUTH_STORAGE_KEY = 'tramplin.auth.session'
const AUTH_SESSION_EVENT = 'tramplin:auth-session-change'

function isBrowser() {
  return typeof window !== 'undefined'
}

function isKnownRole(value: number): value is PlatformRole {
  return value === PlatformRole.Seeker
    || value === PlatformRole.Employer
    || value === PlatformRole.Curator
    || value === PlatformRole.Admin
}

function notifyAuthSessionChanged() {
  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
}

export function resolvePlatformRole(roleNames: string[] | null | undefined) {
  if (!roleNames?.length) {
    return null
  }

  const normalizedRoles = roleNames.map((role) => role.toLowerCase())

  if (normalizedRoles.some((role) => role.includes('curator'))) {
    return PlatformRole.Curator
  }

  if (normalizedRoles.some((role) => role.includes('admin'))) {
    return PlatformRole.Admin
  }

  if (normalizedRoles.some((role) => role.includes('employer'))) {
    return PlatformRole.Employer
  }

  if (normalizedRoles.some((role) => role.includes('seeker'))) {
    return PlatformRole.Seeker
  }

  return null
}

export function createAuthSession(response: AuthResponse, fallbackRole?: PlatformRole | null): AuthSession {
  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshToken: response.refreshToken,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt,
    platformRole: resolvePlatformRole(response.user?.roles) ?? fallbackRole ?? null,
    user: response.user,
  }
}

export function loadAuthSession() {
  if (!isBrowser()) {
    return null
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawSession) {
    return null
  }

  try {
    const parsedSession = JSON.parse(rawSession) as Partial<AuthSession>
    const parsedRole = typeof parsedSession.platformRole === 'number' ? parsedSession.platformRole : null

    return {
      accessToken: typeof parsedSession.accessToken === 'string' ? parsedSession.accessToken : null,
      accessTokenExpiresAt: typeof parsedSession.accessTokenExpiresAt === 'string' ? parsedSession.accessTokenExpiresAt : null,
      refreshToken: typeof parsedSession.refreshToken === 'string' ? parsedSession.refreshToken : null,
      refreshTokenExpiresAt: typeof parsedSession.refreshTokenExpiresAt === 'string' ? parsedSession.refreshTokenExpiresAt : null,
      platformRole: parsedRole !== null && isKnownRole(parsedRole) ? parsedRole : null,
      user: parsedSession.user ?? null,
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function saveAuthSession(session: AuthSession) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  notifyAuthSessionChanged()
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  notifyAuthSessionChanged()
}

export function hasActiveSession(session: AuthSession | null) {
  return Boolean(session?.accessToken && session.user)
}

export function getDefaultRouteForRole(role: PlatformRole | null) {
  if (role === PlatformRole.Employer) {
    return '/dashboard/employer'
  }

  if (role === PlatformRole.Curator || role === PlatformRole.Admin) {
    return '/dashboard/curator'
  }

  return '/dashboard/seeker'
}

export function getPostRegisterRoute(role: PlatformRole) {
  if (role === PlatformRole.Employer) {
    return '/verification/employer'
  }

  return getDefaultRouteForRole(role)
}

export function getDashboardLabelForRole(role: PlatformRole | null) {
  if (role === PlatformRole.Employer) {
    return 'Кабинет работодателя'
  }

  if (role === PlatformRole.Curator || role === PlatformRole.Admin) {
    return 'Кураторская панель'
  }

  return 'Кабинет соискателя'
}

export function subscribeToAuthSession(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key !== AUTH_STORAGE_KEY) {
      return
    }

    listener()
  }

  window.addEventListener('storage', handleStorageChange)
  window.addEventListener(AUTH_SESSION_EVENT, listener)

  return () => {
    window.removeEventListener('storage', handleStorageChange)
    window.removeEventListener(AUTH_SESSION_EVENT, listener)
  }
}

export function getSafeRedirectPath(candidate: string | null, role: PlatformRole | null) {
  if (!candidate || !candidate.startsWith('/')) {
    return getDefaultRouteForRole(role)
  }

  if (candidate === '/login' || candidate === '/register') {
    return getDefaultRouteForRole(role)
  }

  return candidate
}
