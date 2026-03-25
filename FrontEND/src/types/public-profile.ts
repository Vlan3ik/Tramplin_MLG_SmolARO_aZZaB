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

export type PublicProfileResumeSkill = {
  tagId: number
  tagName: string
  level: number | null
  yearsExperience: number | null
}

export type PublicProfileResumeExperience = {
  id: number
  companyId: number | null
  companyName: string
  position: string
  description: string | null
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
}

export type PublicProfileResumeEducation = {
  id: number
  university: string
  faculty: string | null
  specialty: string | null
  course: number | null
  graduationYear: number | null
}

export type PublicProfileResumeLink = {
  id: number
  kind: string
  url: string
  label: string | null
}

export type PublicProfileResume = {
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  skills: PublicProfileResumeSkill[]
  experiences: PublicProfileResumeExperience[]
  projects: PublicProfileResumeProject[]
  education: PublicProfileResumeEducation[]
  links: PublicProfileResumeLink[]
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
  cityId: number | null
  city: string | null
  about: string | null
  avatarUrl: string | null
  profileBannerUrl: string | null
  resume: PublicProfileResume | null
  stats: PublicProfileStats
  visibilityMode: string
}
