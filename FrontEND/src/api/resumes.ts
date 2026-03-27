import type { ResumeDiscoveryItem, ResumeDiscoveryQuery, ResumeDiscoveryResponse } from '../types/resumes'
import { getJson } from './client'

type ResumeSkillShortApi = {
  tagId: number
  tagName?: string | null
}

type ResumeDiscoveryItemApi = {
  userId: number
  username?: string | null
  fio?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  headline?: string | null
  desiredPosition?: string | null
  salaryFrom?: number | null
  salaryTo?: number | null
  currencyCode?: string | null
  openToWork?: boolean | null
  resumeUpdatedAt?: string | null
  skills?: ResumeSkillShortApi[] | null
  isFollowedByMe?: boolean | null
  followersCount?: number | null
}

type ResumeDiscoveryResponseApi = {
  items?: ResumeDiscoveryItemApi[] | null
  totalCount?: number | null
  total?: number | null
  page?: number | null
  pageSize?: number | null
}

function mapResumeItem(item: ResumeDiscoveryItemApi): ResumeDiscoveryItem {
  return {
    userId: item.userId,
    username: item.username ?? '',
    displayName: item.fio ?? item.displayName ?? 'Без имени',
    avatarUrl: item.avatarUrl ?? null,
    headline: item.headline ?? null,
    desiredPosition: item.desiredPosition ?? null,
    salaryFrom: item.salaryFrom ?? null,
    salaryTo: item.salaryTo ?? null,
    currencyCode: item.currencyCode ?? null,
    openToWork: Boolean(item.openToWork),
    resumeUpdatedAt: item.resumeUpdatedAt ?? '',
    skills: Array.isArray(item.skills)
      ? item.skills
          .filter((skill) => skill.tagId > 0)
          .map((skill) => ({
            tagId: skill.tagId,
            tagName: skill.tagName ?? 'Навык',
          }))
      : [],
    isFollowedByMe: Boolean(item.isFollowedByMe),
    followersCount: item.followersCount ?? 0,
  }
}

export async function fetchResumeDiscovery(query: ResumeDiscoveryQuery, signal?: AbortSignal): Promise<ResumeDiscoveryResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 12))

  if (query.search?.trim()) {
    params.set('search', query.search.trim())
  }

  if (query.openToWork !== null && query.openToWork !== undefined) {
    params.set('openToWork', String(query.openToWork))
  }

  if (query.salaryFrom !== null && query.salaryFrom !== undefined) {
    params.set('salaryFrom', String(query.salaryFrom))
  }

  if (query.salaryTo !== null && query.salaryTo !== undefined) {
    params.set('salaryTo', String(query.salaryTo))
  }

  if (query.onlyFollowed) {
    params.set('onlyFollowed', 'true')
  }

  for (const tagId of query.tagIds ?? []) {
    if (tagId > 0) {
      params.append('tagIds', String(tagId))
    }
  }

  const response = await getJson<ResumeDiscoveryResponseApi>(`/resumes?${params.toString()}`, {
    signal,
  })

  const items = Array.isArray(response.items) ? response.items.map(mapResumeItem) : []

  return {
    items,
    totalCount: response.totalCount ?? response.total ?? 0,
    total: response.total ?? response.totalCount ?? 0,
    page: response.page ?? query.page ?? 1,
    pageSize: response.pageSize ?? query.pageSize ?? 12,
  }
}

