export type SeekerProfile = {
  userId: number
  displayName: string
  firstName: string
  lastName: string
  middleName: string | null
  phone: string | null
  about: string | null
  avatarUrl: string | null
}

export type UpdateSeekerProfileRequest = {
  displayName: string
  firstName: string
  lastName: string
  middleName: string | null
  phone: string | null
  about: string | null
  avatarUrl: string | null
}
