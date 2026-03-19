const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const AUTH_STORAGE_KEY = 'tramplin.auth.session'

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
  window.dispatchEvent(new Event('tramplin:auth-session-change'))
}

function createHeaders(withAuth: boolean) {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')

  if (withAuth) {
    const accessToken = readStoredSession()?.accessToken

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }
  }

  return headers
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
    return false
  }

  const payload = (await response.json()) as RefreshApiResponse
  writeStoredTokens(payload)
  return true
}

function canRetryWithRefresh(path: string, withAuth: boolean) {
  if (!withAuth) {
    return false
  }

  return !path.startsWith('/auth/')
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
  },
) {
  const withAuth = options?.withAuth ?? true

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: createHeaders(withAuth),
    signal: options?.signal,
  })

  if (response.status === 401 && canRetryWithRefresh(path, withAuth)) {
    const refreshed = await tryRefreshAccessToken()

    if (refreshed) {
      return getJson<TResponse>(path, {
        ...options,
        withAuth,
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
  },
) {
  const withAuth = options?.withAuth ?? true

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: createHeaders(withAuth),
    body: JSON.stringify(payload),
    signal: options?.signal,
  })

  if (response.status === 401 && canRetryWithRefresh(path, withAuth)) {
    const refreshed = await tryRefreshAccessToken()

    if (refreshed) {
      return postJson<TResponse, TRequest>(path, payload, {
        ...options,
        withAuth,
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
