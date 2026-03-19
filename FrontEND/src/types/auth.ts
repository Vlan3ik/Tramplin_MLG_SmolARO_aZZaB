export const PlatformRole = {
  Seeker: 1,
  Employer: 2,
  Curator: 3,
} as const

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole]

export type AuthUser = {
  id: number
  email: string | null
  username: string | null
  avatarUrl: string | null
  roles: string[] | null
}

export type AuthResponse = {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshTokenExpiresAt: string | null
  user: AuthUser | null
}

export type LoginRequest = {
  email: string
  password: string
}

export type RefreshRequest = {
  refreshToken: string
}

export type LogoutRequest = {
  refreshToken: string
}

export type RegisterRequest = {
  email: string
  password: string
  firstName: string
  lastName: string
  role: PlatformRole
}

export type AuthSession = {
  accessToken: string | null
  accessTokenExpiresAt: string | null
  refreshToken: string | null
  refreshTokenExpiresAt: string | null
  platformRole: PlatformRole | null
  user: AuthUser | null
}
