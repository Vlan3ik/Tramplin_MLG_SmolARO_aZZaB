export type PublicPortfolioProjectCard = {
  projectId: number
  title: string
  mainPhotoUrl: string | null
  authorFio: string
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
  title: string
  authorRole: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  repoUrl: string | null
  demoUrl: string | null
  photos: PublicPortfolioProjectPhoto[]
}
