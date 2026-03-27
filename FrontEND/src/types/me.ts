export type CandidateGender = 0 | 1 | 2

export type SeekerProfile = {
  userId: number
  username: string
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string | null
  gender: CandidateGender
  phone: string | null
  cityId: number | null
  city: string | null
  about: string | null
  avatarUrl: string | null
}

export type UpdateSeekerProfileRequest = {
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string | null
  gender: CandidateGender | null
  phone: string | null
  cityId: number | null
  city?: string | null
  about: string | null
  avatarUrl: string | null
}

export type SeekerProfileStats = {
  applicationsTotal: number
  applicationsOpen: number
  applicationsClosed: number
  applicationsRejected: number
  internshipsCompleted: number
  eventsAttended: number
  mentorshipParticipations: number
}

export type PrivacyScope = 1 | 2 | 3

export type SeekerSettings = {
  userId: number
  profileVisibility: PrivacyScope
  resumeVisibility: PrivacyScope
  openToWork: boolean
  showContactsInResume: boolean
  showLinksInResume: boolean
  showSocialProofs: boolean
}

export type UpdateSeekerSettingsRequest = {
  profileVisibility: PrivacyScope
  resumeVisibility: PrivacyScope
  openToWork: boolean
  showContactsInResume: boolean
  showLinksInResume: boolean
  showSocialProofs: boolean
}
