const RAW_ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const DEFAULT_FALLBACK_API_BASE_URL = 'http://169.254.185.29:1488//api'
const API_BASE_URL_STORAGE_KEY = 'tramplin.dev.api-base-url'
const API_BASE_URL_QUERY_KEY = 'apiBaseUrl'
const API_HOST_QUERY_KEY = 'apiHost'
const API_RESET_QUERY_KEY = 'apiReset'

function isBrowser() {
  return typeof window !== 'undefined'
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeApiBaseUrl(rawValue: string, forceApiPath: boolean) {
  const trimmed = rawValue.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('/')) {
    const relativePath = trimTrailingSlash(trimmed) || '/api'
    return forceApiPath && relativePath === '/' ? '/api' : relativePath
  }

  try {
    const url = new URL(trimmed)
    const currentPath = trimTrailingSlash(url.pathname) || '/'

    if (forceApiPath && currentPath === '/') {
      url.pathname = '/api'
    } else {
      url.pathname = currentPath
    }

    return trimTrailingSlash(url.toString())
  } catch {
    return null
  }
}

function resolveApiBaseUrl() {
  if (!isBrowser()) {
    return normalizeApiBaseUrl(RAW_ENV_API_BASE_URL || DEFAULT_FALLBACK_API_BASE_URL, true) || DEFAULT_FALLBACK_API_BASE_URL
  }

  const params = new URLSearchParams(window.location.search)
  const shouldReset = params.get(API_RESET_QUERY_KEY) === '1'

  if (shouldReset) {
    window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY)
  }

  const queryBaseValue = params.get(API_BASE_URL_QUERY_KEY)
  const queryHostValue = params.get(API_HOST_QUERY_KEY)
  const queryUrl =
    (queryBaseValue ? normalizeApiBaseUrl(queryBaseValue, true) : null) ||
    (queryHostValue ? normalizeApiBaseUrl(queryHostValue, true) : null)

  if (queryUrl) {
    window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, queryUrl)
    return queryUrl
  }

  const storedUrl = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)
  const normalizedStoredUrl = storedUrl ? normalizeApiBaseUrl(storedUrl, true) : null

  if (normalizedStoredUrl) {
    return normalizedStoredUrl
  }

  const envUrl = normalizeApiBaseUrl(RAW_ENV_API_BASE_URL || '', true)
  return envUrl || DEFAULT_FALLBACK_API_BASE_URL
}

function resolveApiOrigin(baseUrl: string) {
  if (baseUrl.startsWith('/')) {
    return isBrowser() ? window.location.origin : ''
  }

  try {
    return new URL(baseUrl).origin
  } catch {
    return isBrowser() ? window.location.origin : ''
  }
}

export const API_BASE_URL = resolveApiBaseUrl()
export const API_ORIGIN = resolveApiOrigin(API_BASE_URL)

