export const PlatformRole = {
  Seeker: 1,
  Employer: 2,
  Curator: 3,
} as const

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole]

export type AuthUser = {
  id: number
  email: string | null
  displayName: string | null
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

export type RegisterRequest = {
  email: string
  password: string
  displayName: string
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
