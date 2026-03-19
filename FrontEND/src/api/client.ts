const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const AUTH_STORAGE_KEY = 'tramplin.auth.session'
const AUTH_SESSION_EVENT = 'tramplin:auth-session-change'
const TOKEN_REFRESH_SKEW_MS = 60_000

export const API_BASE_URL = RAW_API_BASE_URL
  ? RAW_API_BASE_URL.replace(/\/$/, '')
  : 'http://169.254.185.29:1488/api'

type ApiErrorPayload = {
  code?: string
  detail?: string
  message?: string
  title?: string
}

type StoredAuthSession = {
  accessToken?: string | null
  refreshToken?: string | null
  accessTokenExpiresAt?: string | null
  refreshTokenExpiresAt?: string | null
}

type RefreshApiResponse = {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshTokenExpiresAt: string | null
}

let refreshInFlight: Promise<boolean> | null = null

function isBrowser() {
  return typeof window !== 'undefined'
}

function readStoredSession(): StoredAuthSession | null {
  if (!isBrowser()) {
    return null
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!rawSession) {
    return null
  }

  try {
    return JSON.parse(rawSession) as StoredAuthSession
  } catch {
    return null
  }
}

function writeStoredTokens(tokens: RefreshApiResponse) {
  if (!isBrowser()) {
    return
  }

  const currentSession = readStoredSession() ?? {}
  const nextSession: StoredAuthSession = {
    ...currentSession,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
}

function clearStoredSession() {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
}

function createHeaders(withAuth: boolean, includeJsonContentType: boolean) {
  const headers = new Headers()

  if (includeJsonContentType) {
    headers.set('Content-Type', 'application/json')
  }

  if (withAuth) {
    const accessToken = readStoredSession()?.accessToken

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  return headers
}

function isAccessTokenExpiringSoon(accessTokenExpiresAt: string | null | undefined) {
  if (!accessTokenExpiresAt) {
    return true
  }

  const expiresAtMs = Date.parse(accessTokenExpiresAt)

  if (Number.isNaN(expiresAtMs)) {
    return true
  }

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_SKEW_MS
}

async function tryRefreshAccessToken() {
  const refreshToken = readStoredSession()?.refreshToken

  if (!refreshToken) {
    return false
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    clearStoredSession()
    return false
  }

  const payload = (await response.json()) as RefreshApiResponse
  writeStoredTokens(payload)
  return true
}

function refreshAccessTokenShared() {
  if (!refreshInFlight) {
    refreshInFlight = tryRefreshAccessToken().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

function canRetryWithRefresh(path: string, withAuth: boolean) {
  if (!withAuth) {
    return false
  }

  return !path.startsWith('/auth/')
}

async function ensureFreshAccessToken(path: string, withAuth: boolean) {
  if (!canRetryWithRefresh(path, withAuth)) {
    return true
  }

  const session = readStoredSession()

  if (!session?.refreshToken) {
    return true
  }

  if (!isAccessTokenExpiringSoon(session.accessTokenExpiresAt)) {
    return true
  }

  return refreshAccessTokenShared()
}

function toApiErrorMessage(payload: ApiErrorPayload | null, status: number) {
  if (payload?.message) {
    return payload.message
  }

  if (payload?.detail) {
    return payload.detail
  }

  if (payload?.title) {
    return payload.title
  }

  if (payload?.code) {
    return `Ошибка API: ${payload.code}`
  }

  return `Ошибка запроса (${status})`
}

export async function getJson<TResponse>(
  path: string,
  options?: {
    signal?: AbortSignal
    withAuth?: boolean
    retryOnUnauthorized?: boolean
  },
) {
  const withAuth = options?.withAuth ?? true
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true
  await ensureFreshAccessToken(path, withAuth)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: createHeaders(withAuth, false),
    signal: options?.signal,
  })

  if (response.status === 401 && retryOnUnauthorized && canRetryWithRefresh(path, withAuth)) {
    const refreshed = await refreshAccessTokenShared()

    if (refreshed) {
      return getJson<TResponse>(path, {
        ...options,
        withAuth,
        retryOnUnauthorized: false,
      })
    }
  }

  const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
  const responseBody = isJsonResponse ? ((await response.json()) as TResponse | ApiErrorPayload) : null

  if (!response.ok) {
    throw new Error(toApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
  }

  return responseBody as TResponse
}

export async function postJson<TResponse, TRequest extends object>(
  path: string,
  payload: TRequest,
  options?: {
    signal?: AbortSignal
    withAuth?: boolean
    retryOnUnauthorized?: boolean
  },
) {
  const withAuth = options?.withAuth ?? true
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true
  await ensureFreshAccessToken(path, withAuth)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: createHeaders(withAuth, true),
    body: JSON.stringify(payload),
    signal: options?.signal,
  })

  if (response.status === 401 && retryOnUnauthorized && canRetryWithRefresh(path, withAuth)) {
    const refreshed = await refreshAccessTokenShared()

    if (refreshed) {
      return postJson<TResponse, TRequest>(path, payload, {
        ...options,
        withAuth,
        retryOnUnauthorized: false,
      })
    }
  }

  const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
  const responseBody = isJsonResponse ? ((await response.json()) as TResponse | ApiErrorPayload) : null

  if (!response.ok) {
    throw new Error(toApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
  }

  return responseBody as TResponse
}
