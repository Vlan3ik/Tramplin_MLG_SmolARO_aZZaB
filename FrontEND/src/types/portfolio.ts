export type PublicPortfolioProjectCard = {
  projectId: number
  title: string
  mainPhotoUrl: string | null
  authorFio: string
  authorAvatarUrl: string | null
  primaryRole: string | null
  shortDescription: string | null
}

export type PublicPortfolioProjectPhoto = {
  id: number
  url: string
  sortOrder: number
  isMain: boolean
}

export type PublicPortfolioProjectDetail = {
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
  photos: PublicPortfolioProjectPhoto[]
  participants: Array<{
    userId: number
    username: string | null
    fio: string | null
    avatarUrl: string | null
    role: string | null
  }>
  collaborations: Array<{
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
  }>
}
