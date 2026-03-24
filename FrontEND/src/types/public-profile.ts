export type PublicProfileResumeProject = {
  id: number
  title: string
  role: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  repoUrl: string | null
  demoUrl: string | null
}

export type PublicProfileResume = {
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  projects: PublicProfileResumeProject[]
}

export type PublicProfileStats = {
  applicationsTotal: number
  applicationsNew: number
  applicationsInReview: number
  applicationsInterview: number
  applicationsOffer: number
  applicationsHired: number
  applicationsRejected: number
  applicationsCanceled: number
  internshipsCompleted: number
  jobsCompleted: number
  eventsParticipations: number
}

export type PublicProfile = {
  userId: number
  username: string
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string | null
  gender: number | null
  phone: string | null
  about: string | null
  avatarUrl: string | null
  profileBannerUrl: string | null
  resume: PublicProfileResume | null
  stats: PublicProfileStats
  visibilityMode: string
}
