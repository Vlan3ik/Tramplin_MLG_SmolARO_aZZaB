import type { AuthResponse, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest } from '../types/auth'
import { postJson } from './client'

export function registerUser(payload: RegisterRequest) {
  return postJson<AuthResponse, RegisterRequest>('/auth/register', payload, { withAuth: false })
}

export function loginUser(payload: LoginRequest) {
  return postJson<AuthResponse, LoginRequest>('/auth/login', payload, { withAuth: false })
}

export function refreshAuth(payload: RefreshRequest) {
  return postJson<AuthResponse, RefreshRequest>('/auth/refresh', payload, { withAuth: false })
}

export function logoutUser(payload: LogoutRequest) {
  return postJson<void, LogoutRequest>('/auth/logout', payload)
}
