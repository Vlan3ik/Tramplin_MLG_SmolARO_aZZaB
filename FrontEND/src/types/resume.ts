export type ResumeSkill = {
  tagId: number
  tagName: string
  level: number
  yearsExperience: number
}

export type ResumeProject = {
  id: number
  title: string
  role: string
  description: string
  startDate: string
  endDate: string
  repoUrl: string
  demoUrl: string
  mainPhotoUrl?: string | null
}

export type ResumeExperience = {
  id: number
  companyId: number | null
  companyName: string
  position: string
  description: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

export type ResumeEducation = {
  id: number
  university: string
  faculty: string
  specialty: string
  course: number
  graduationYear: number
}

export type ResumeLink = {
  id: number
  kind: string
  url: string
  label: string
}

export type SeekerResume = {
  userId: number
  headline: string
  desiredPosition: string
  summary: string
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string
  skills: ResumeSkill[]
  experiences: ResumeExperience[]
  projects: ResumeProject[]
  education: ResumeEducation[]
  links: ResumeLink[]
}
