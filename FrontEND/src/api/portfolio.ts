import type { PagedResponse } from '../types/catalog'
import type { PublicPortfolioProjectCard, PublicPortfolioProjectDetail } from '../types/portfolio'
import { deleteJson, getJson, patchJson, postForm, postJson, putJson } from './client'

type PublicPortfolioProjectApi = {
  projectId: number
  title: string
  mainPhotoUrl: string | null
  authorFio: string
  authorAvatarUrl: string | null
  primaryRole: string | null
  shortDescription: string | null
}

type PublicPortfolioProjectResponseApi = PagedResponse<PublicPortfolioProjectApi>

type PublicPortfolioProjectDetailApi = {
  projectId: number
  authorUserId: number
  authorUsername: string | null
  authorFio: string | null
  authorAvatarUrl: string | null
  title: string
  authorRole: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  repoUrl: string | null
  demoUrl: string | null
  photos: Array<{
    id: number
    url: string
    sortOrder: number
    isMain: boolean
  }>
  participants?: Array<{
    userId: number
    username: string | null
    fio: string | null
    avatarUrl: string | null
    role: string | null
  }> | null
  collaborations?: Array<{
    id: number
    type: number
    userId: number | null
    username: string | null
    userFio: string | null
    userAvatarUrl: string | null
    vacancyId: number | null
    vacancyTitle: string | null
    opportunityId: number | null
    opportunityTitle: string | null
    label: string | null
  }> | null
}

type PortfolioProjectMutationRequest = {
  title: string
  role: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  repoUrl: string | null
  demoUrl: string | null
  isPrivate?: boolean
  participants: Array<{
    userId: number
    role: string
  }>
  collaborations: Array<{
    type: number
    userId: number | null
    vacancyId: number | null
    opportunityId: number | null
    label: string | null
    sortOrder: number
  }>
}

type PortfolioProjectMutationResponse = {
  projectId: number
}

type PortfolioProjectPhotoResponse = {
  photoId: number
  url: string
  sortOrder: number
  isMain: boolean
}

function mapProject(item: PublicPortfolioProjectApi): PublicPortfolioProjectCard {
  return {
    projectId: item.projectId,
    title: item.title,
    mainPhotoUrl: item.mainPhotoUrl,
    authorFio: item.authorFio,
    authorAvatarUrl: item.authorAvatarUrl,
    primaryRole: item.primaryRole,
    shortDescription: item.shortDescription,
  }
}

function mapProjectDetail(item: PublicPortfolioProjectDetailApi): PublicPortfolioProjectDetail {
  return {
    projectId: item.projectId,
    authorUserId: item.authorUserId,
    authorUsername: item.authorUsername,
    authorFio: item.authorFio,
    authorAvatarUrl: item.authorAvatarUrl,
    title: item.title,
    authorRole: item.authorRole,
    description: item.description,
    startDate: item.startDate,
    endDate: item.endDate,
    repoUrl: item.repoUrl,
    demoUrl: item.demoUrl,
    photos: Array.isArray(item.photos)
      ? item.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          sortOrder: photo.sortOrder,
          isMain: Boolean(photo.isMain),
        }))
      : [],
    participants: Array.isArray(item.participants)
      ? item.participants.map((participant) => ({
          userId: participant.userId,
          username: participant.username ?? null,
          fio: participant.fio ?? null,
          avatarUrl: participant.avatarUrl ?? null,
          role: participant.role ?? null,
        }))
      : [],
    collaborations: Array.isArray(item.collaborations)
      ? item.collaborations.map((collaboration) => ({
          id: collaboration.id,
          type: collaboration.type,
          userId: collaboration.userId ?? null,
          username: collaboration.username ?? null,
          userFio: collaboration.userFio ?? null,
          userAvatarUrl: collaboration.userAvatarUrl ?? null,
          vacancyId: collaboration.vacancyId ?? null,
          vacancyTitle: collaboration.vacancyTitle ?? null,
          opportunityId: collaboration.opportunityId ?? null,
          opportunityTitle: collaboration.opportunityTitle ?? null,
          label: collaboration.label ?? null,
        }))
      : [],
  }
}

export async function fetchPublicPortfolioProjects(username: string, signal?: AbortSignal): Promise<PublicPortfolioProjectCard[]> {
  const normalized = username.trim()
  if (!normalized) {
    return []
  }

  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('pageSize', '100')

  const response = await getJson<PublicPortfolioProjectResponseApi>(
    `/portfolio/projects/users/${encodeURIComponent(normalized)}?${params.toString()}`,
    { signal, withAuth: false },
  )

  return (response.items ?? []).map(mapProject)
}

export async function fetchPublicPortfolioProjectDetail(
  projectId: number,
  options?: { signal?: AbortSignal; withAuth?: boolean },
): Promise<PublicPortfolioProjectDetail> {
  const response = await getJson<PublicPortfolioProjectDetailApi>(`/portfolio/projects/${projectId}`, {
    signal: options?.signal,
    withAuth: options?.withAuth ?? false,
  })

  return mapProjectDetail(response)
}

export async function createMyPortfolioProject(payload: PortfolioProjectMutationRequest) {
  return postJson<PortfolioProjectMutationResponse, PortfolioProjectMutationRequest>('/me/portfolio/projects', {
    ...payload,
    isPrivate: Boolean(payload.isPrivate),
    participants: Array.isArray(payload.participants) ? payload.participants : [],
    collaborations: Array.isArray(payload.collaborations) ? payload.collaborations : [],
  })
}

export async function updateMyPortfolioProject(projectId: number, payload: PortfolioProjectMutationRequest) {
  return putJson<PortfolioProjectMutationResponse, PortfolioProjectMutationRequest>(`/me/portfolio/projects/${projectId}`, {
    ...payload,
    isPrivate: Boolean(payload.isPrivate),
    participants: Array.isArray(payload.participants) ? payload.participants : [],
    collaborations: Array.isArray(payload.collaborations) ? payload.collaborations : [],
  })
}

export async function deleteMyPortfolioProject(projectId: number) {
  return deleteJson<void>(`/me/portfolio/projects/${projectId}`)
}

export async function uploadMyPortfolioProjectPhoto(
  projectId: number,
  file: File,
  options?: { isMain?: boolean; sortOrder?: number },
) {
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams()
  if (options?.isMain) {
    params.set('isMain', 'true')
  }
  if (typeof options?.sortOrder === 'number') {
    params.set('sortOrder', String(options.sortOrder))
  }

  const query = params.toString()
  return postForm<PortfolioProjectPhotoResponse>(
    `/media/me/portfolio-projects/${projectId}/photos${query ? `?${query}` : ''}`,
    formData,
  )
}

export async function updateMyPortfolioProjectPhoto(
  projectId: number,
  photoId: number,
  payload: { sortOrder: number; isMain: boolean },
) {
  return patchJson<void, { sortOrder: number; isMain: boolean }>(`/me/portfolio/projects/${projectId}/photos/${photoId}`, payload)
}

export async function deleteMyPortfolioProjectPhoto(projectId: number, photoId: number) {
  return deleteJson<void>(`/me/portfolio/projects/${projectId}/photos/${photoId}`)
}

export type { PortfolioProjectMutationRequest, PortfolioProjectMutationResponse, PortfolioProjectPhotoResponse }
