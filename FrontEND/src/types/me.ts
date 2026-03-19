export type SeekerProfile = {
  userId: number
  username: string
  firstName: string
  lastName: string
  middleName: string | null
  phone: string | null
  about: string | null
  avatarUrl: string | null
}

export type UpdateSeekerProfileRequest = {
  firstName: string
  lastName: string
  middleName: string | null
  phone: string | null
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
