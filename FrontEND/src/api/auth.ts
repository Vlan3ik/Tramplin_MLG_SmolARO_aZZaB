import type { AuthResponse, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, VkLoginUrlResponse } from '../types/auth'
import { getJson, postJson } from './client'

export function registerUser(payload: RegisterRequest) {
  return postJson<AuthResponse, RegisterRequest>('/auth/register', payload, { withAuth: false })
}

export function loginUser(payload: LoginRequest) {
  return postJson<AuthResponse, LoginRequest>('/auth/login', payload, { withAuth: false })
}

export function getVkLoginUrl(state?: string) {
  const query = state ? `?state=${encodeURIComponent(state)}` : ''
  return getJson<VkLoginUrlResponse>(`/auth/vk/url${query}`, { withAuth: false })
}

export function loginViaVk(code: string) {
  return postJson<AuthResponse, { code: string }>('/auth/vk/login', { code }, { withAuth: false })
}

export function refreshAuth(payload: RefreshRequest) {
  return postJson<AuthResponse, RefreshRequest>('/auth/refresh', payload, { withAuth: false })
}

export function logoutUser(payload: LogoutRequest) {
  return postJson<void, LogoutRequest>('/auth/logout', payload)
}
