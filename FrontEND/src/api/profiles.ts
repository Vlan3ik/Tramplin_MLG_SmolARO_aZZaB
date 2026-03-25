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
  cityId: number | null
  city: string | null
  about: string | null
  avatarUrl: string | null
  profileBannerUrl: string | null
  resume: {
    headline: string | null
    desiredPosition: string | null
    summary: string | null
    salaryFrom: number | null
    salaryTo: number | null
    currencyCode: string | null
    skills: Array<{
      tagId: number
      tagName: string
      level: number | null
      yearsExperience: number | null
    }> | null
    experiences: Array<{
      id: number
      companyId: number | null
      companyName: string
      position: string
      description: string | null
      startDate: string | null
      endDate: string | null
      isCurrent: boolean
    }> | null
    projects: Array<{
      id: number
      title: string
      role: string | null
      description: string | null
      startDate: string | null
      endDate: string | null
      repoUrl: string | null
      demoUrl: string | null
    }> | null
    education: Array<{
      id: number
      university: string
      faculty: string | null
      specialty: string | null
      course: number | null
      graduationYear: number | null
    }> | null
    links: Array<{
      id: number
      kind: string
      url: string
      label: string | null
    }> | null
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
    cityId: response.cityId,
    city: response.city,
    about: response.about,
    avatarUrl: response.avatarUrl,
    profileBannerUrl: response.profileBannerUrl,
    resume: response.resume
      ? {
          headline: response.resume.headline,
          desiredPosition: response.resume.desiredPosition,
          summary: response.resume.summary,
          salaryFrom: response.resume.salaryFrom,
          salaryTo: response.resume.salaryTo,
          currencyCode: response.resume.currencyCode,
          skills: (response.resume.skills ?? []).map((skill) => ({
            tagId: skill.tagId,
            tagName: skill.tagName,
            level: skill.level,
            yearsExperience: skill.yearsExperience,
          })),
          experiences: (response.resume.experiences ?? []).map((experience) => ({
            id: experience.id,
            companyId: experience.companyId,
            companyName: experience.companyName,
            position: experience.position,
            description: experience.description,
            startDate: experience.startDate,
            endDate: experience.endDate,
            isCurrent: experience.isCurrent,
          })),
          projects: (response.resume.projects ?? []).map((project) => ({
            id: project.id,
            title: project.title,
            role: project.role,
            description: project.description,
            startDate: project.startDate,
            endDate: project.endDate,
            repoUrl: project.repoUrl,
            demoUrl: project.demoUrl,
          })),
          education: (response.resume.education ?? []).map((education) => ({
            id: education.id,
            university: education.university,
            faculty: education.faculty,
            specialty: education.specialty,
            course: education.course,
            graduationYear: education.graduationYear,
          })),
          links: (response.resume.links ?? []).map((link) => ({
            id: link.id,
            kind: link.kind,
            url: link.url,
            label: link.label,
          })),
        }
      : null,
    stats: response.stats,
    visibilityMode: response.visibilityMode,
  }
}
