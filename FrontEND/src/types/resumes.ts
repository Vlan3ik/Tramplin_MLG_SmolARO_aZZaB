import type { PagedResponse } from './catalog'

export type ResumeSkillShort = {
  tagId: number
  tagName: string
}

export type ResumeDiscoveryItem = {
  userId: number
  username: string
  displayName: string
  avatarUrl: string | null
  headline: string | null
  desiredPosition: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  openToWork: boolean
  resumeUpdatedAt: string
  skills: ResumeSkillShort[]
  isFollowedByMe: boolean
  followersCount: number
}

export type ResumeDiscoveryQuery = {
  page?: number
  pageSize?: number
  search?: string
  openToWork?: boolean | null
  salaryFrom?: number | null
  salaryTo?: number | null
  tagIds?: number[]
  onlyFollowed?: boolean
}

export type ResumeDiscoveryResponse = PagedResponse<ResumeDiscoveryItem>
