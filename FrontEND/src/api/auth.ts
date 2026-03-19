import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'

type ApiErrorPayload = {
  code?: string
  detail?: string
  details?: unknown
  message?: string
  title?: string
}

function extractApiErrorMessage(payload: ApiErrorPayload | null, status: number) {
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

async function postJson<TResponse, TRequest extends object>(path: string, payload: TRequest) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
    const responseBody = isJsonResponse ? ((await response.json()) as TResponse | ApiErrorPayload) : null

    if (!response.ok) {
      throw new Error(extractApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
    }

    return responseBody as TResponse
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error('Не удалось связаться с сервером. Проверьте доступность API.')
  }
}

export function registerUser(payload: RegisterRequest) {
  return postJson<AuthResponse, RegisterRequest>('/auth/register', payload)
}

export function loginUser(payload: LoginRequest) {
  return postJson<AuthResponse, LoginRequest>('/auth/login', payload)
}
