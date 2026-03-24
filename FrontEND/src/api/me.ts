import { getJson, putJson } from './client'
import type {
  SeekerProfile,
  SeekerProfileStats,
  SeekerSettings,
  UpdateSeekerProfileRequest,
  UpdateSeekerSettingsRequest,
} from '../types/me'
import type { SeekerResume } from '../types/resume'

type ResumeApiResponse = {
  userId: number
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  skills?: Array<{
    tagId: number
    tagName: string
    level: number | null
    yearsExperience: number | null
  }> | null
  experiences?: Array<{
    id: number
    companyId: number | null
    companyName: string
    position: string
    description: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
  }> | null
  projects?: Array<{
    id: number
    title: string
    role: string | null
    description: string | null
    startDate: string | null
    endDate: string | null
    repoUrl: string | null
    demoUrl: string | null
    mainPhotoUrl?: string | null
    isPrivate?: boolean | null
  }> | null
  education?: Array<{
    id: number
    university: string
    faculty: string | null
    specialty: string | null
    course: number | null
    graduationYear: number | null
  }> | null
  links?: Array<{
    id: number
    kind: string
    url: string
    label: string | null
  }> | null
}

type PublicProfileResponse = {
  stats: SeekerProfileStats
}

type SeekerSettingsApiResponse = {
  userId: number
  profileVisibility: SeekerSettings['profileVisibility']
  resumeVisibility: SeekerSettings['resumeVisibility']
  openToWork: boolean
  showContactsInResume: boolean
}

export type MeApiResponse = {
  id: number
  email: string | null
  username: string | null
  avatarUrl: string | null
  profileBannerUrl: string | null
  roles: string[] | null
}

type UpdateResumeDetailsRequest = {
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  skills: Array<{
    tagId: number
    level: number | null
    yearsExperience: number | null
  }>
  experiences: Array<{
    companyId: number | null
    companyName: string | null
    position: string
    description: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
  }>
  projects: Array<{
    id: number | null
    title: string
    role: string | null
    description: string | null
    startDate: string | null
    endDate: string | null
    repoUrl: string | null
    demoUrl: string | null
  }>
  education: Array<{
    university: string
    faculty: string | null
    specialty: string | null
    course: number | null
    graduationYear: number | null
  }>
  links: Array<{
    kind: string
    url: string
    label: string | null
  }>
}

export function fetchSeekerProfile(signal?: AbortSignal) {
  return getJson<SeekerProfile>('/me/profile', { signal })
}

function normalizeSkillLevel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.round(value)))
}

function normalizeYearsExperience(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, value)
}

export function fetchMe(signal?: AbortSignal) {
  return getJson<MeApiResponse>('/me', { signal })
}

export function updateSeekerProfile(payload: UpdateSeekerProfileRequest) {
  return putJson<SeekerProfile, UpdateSeekerProfileRequest>('/me/profile', payload)
}

export async function fetchSeekerSettings(signal?: AbortSignal): Promise<SeekerSettings> {
  const response = await getJson<SeekerSettingsApiResponse>('/me/settings', { signal })

  return {
    userId: response.userId,
    profileVisibility: response.profileVisibility,
    resumeVisibility: response.resumeVisibility,
    openToWork: response.openToWork,
    showContactsInResume: response.showContactsInResume,
  }
}

export async function updateSeekerSettings(payload: UpdateSeekerSettingsRequest): Promise<SeekerSettings> {
  const response = await putJson<SeekerSettingsApiResponse, UpdateSeekerSettingsRequest>('/me/settings', payload)

  return {
    userId: response.userId,
    profileVisibility: response.profileVisibility,
    resumeVisibility: response.resumeVisibility,
    openToWork: response.openToWork,
    showContactsInResume: response.showContactsInResume,
  }
}

export async function fetchSeekerResume(signal?: AbortSignal): Promise<SeekerResume> {
  const response = await getJson<ResumeApiResponse>('/me/resume/details', { signal })

  return {
    userId: response.userId,
    headline: response.headline ?? '',
    desiredPosition: response.desiredPosition ?? '',
    summary: response.summary ?? '',
    salaryFrom: response.salaryFrom ?? null,
    salaryTo: response.salaryTo ?? null,
    currencyCode: response.currencyCode ?? 'RUB',
    skills: Array.isArray(response.skills)
      ? response.skills.map((skill) => ({
          tagId: skill.tagId,
          tagName: skill.tagName,
          level: normalizeSkillLevel(skill.level),
          yearsExperience: normalizeYearsExperience(skill.yearsExperience),
        }))
      : [],
    experiences: Array.isArray(response.experiences)
      ? response.experiences.map((experience) => ({
          id: experience.id,
          companyId: experience.companyId ?? null,
          companyName: experience.companyName,
          position: experience.position,
          description: experience.description ?? '',
          startDate: experience.startDate ?? '',
          endDate: experience.endDate ?? '',
          isCurrent: Boolean(experience.isCurrent),
        }))
      : [],
    projects: Array.isArray(response.projects)
      ? response.projects.map((project) => ({
          id: project.id,
          title: project.title,
          role: project.role ?? '',
          description: project.description ?? '',
          startDate: project.startDate ?? '',
          endDate: project.endDate ?? '',
          repoUrl: project.repoUrl ?? '',
          demoUrl: project.demoUrl ?? '',
          mainPhotoUrl: project.mainPhotoUrl ?? null,
          isPrivate: Boolean(project.isPrivate),
        }))
      : [],
    education: Array.isArray(response.education)
      ? response.education.map((education) => ({
          id: education.id,
          university: education.university,
          faculty: education.faculty ?? '',
          specialty: education.specialty ?? '',
          course: education.course ?? 0,
          graduationYear: education.graduationYear ?? 0,
        }))
      : [],
    links: Array.isArray(response.links)
      ? response.links.map((link) => ({
          id: link.id,
          kind: link.kind,
          url: link.url,
          label: link.label ?? '',
        }))
      : [],
  }
}

export async function updateSeekerResume(payload: SeekerResume) {
  const body: UpdateResumeDetailsRequest = {
    headline: null,
    desiredPosition: payload.desiredPosition,
    summary: payload.summary,
    salaryFrom: payload.salaryFrom,
    salaryTo: payload.salaryTo,
    currencyCode: 'RUB',
    skills: payload.skills.map((skill) => ({
      tagId: skill.tagId,
      level: normalizeSkillLevel(skill.level),
      yearsExperience: normalizeYearsExperience(skill.yearsExperience),
    })),
    experiences: payload.experiences.map((experience) => ({
      companyId: experience.companyId ?? null,
      companyName: experience.companyName || null,
      position: experience.position,
      description: experience.description || null,
      startDate: experience.startDate || null,
      endDate: experience.isCurrent ? null : experience.endDate || null,
      isCurrent: experience.isCurrent,
    })),
    projects: payload.projects.map((project) => ({
      id: project.id > 0 ? project.id : null,
      title: project.title,
      role: project.role || null,
      description: project.description || null,
      startDate: project.startDate || null,
      endDate: project.endDate || null,
      repoUrl: project.repoUrl || null,
      demoUrl: project.demoUrl || null,
    })),
    education: payload.education.map((education) => ({
      university: education.university,
      faculty: education.faculty || null,
      specialty: education.specialty || null,
      course: education.course || null,
      graduationYear: education.graduationYear || null,
    })),
    links: payload.links.map((link) => ({
      kind: link.kind,
      url: link.url,
      label: link.label || null,
    })),
  }

  const response = await putJson<ResumeApiResponse, UpdateResumeDetailsRequest>('/me/resume/details', body)

  return {
    userId: response.userId,
    headline: response.headline,
    desiredPosition: response.desiredPosition,
    summary: response.summary,
    salaryFrom: response.salaryFrom,
    salaryTo: response.salaryTo,
    currencyCode: response.currencyCode,
  }
}

export async function fetchSeekerProfileStats(username: string, signal?: AbortSignal) {
  const normalized = username.trim()

  if (!normalized) {
    return null
  }

  const response = await getJson<PublicProfileResponse>(`/profiles/${encodeURIComponent(normalized)}`, { signal })
  return response.stats
}
