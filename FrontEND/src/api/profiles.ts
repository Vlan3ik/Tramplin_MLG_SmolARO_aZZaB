import { getJson } from './client'
import type { PublicProfile } from '../types/public-profile'

type PublicProfileApi = {
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
  resume: {
    headline: string | null
    desiredPosition: string | null
    summary: string | null
    salaryFrom: number | null
    salaryTo: number | null
    currencyCode: string | null
    projects: Array<{
      id: number
      title: string
      role: string | null
      description: string | null
      startDate: string | null
      endDate: string | null
      repoUrl: string | null
      demoUrl: string | null
    }>
  } | null
  stats: PublicProfile['stats']
  visibilityMode: string
}

export async function fetchPublicProfileByUsername(username: string, signal?: AbortSignal): Promise<PublicProfile> {
  const normalized = username.trim()
  const response = await getJson<PublicProfileApi>(`/profiles/${encodeURIComponent(normalized)}`, {
    signal,
  })

  return {
    userId: response.userId,
    username: response.username,
    firstName: response.firstName,
    lastName: response.lastName,
    middleName: response.middleName,
    birthDate: response.birthDate,
    gender: response.gender,
    phone: response.phone,
    about: response.about,
    avatarUrl: response.avatarUrl,
    resume: response.resume
      ? {
          headline: response.resume.headline,
          desiredPosition: response.resume.desiredPosition,
          summary: response.resume.summary,
          salaryFrom: response.resume.salaryFrom,
          salaryTo: response.resume.salaryTo,
          currencyCode: response.resume.currencyCode,
          projects: response.resume.projects.map((project) => ({
            id: project.id,
            title: project.title,
            role: project.role,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            repoUrl: project.repoUrl,
            demoUrl: project.demoUrl,
          })),
        }
      : null,
    stats: response.stats,
    visibilityMode: response.visibilityMode,
  }
}

