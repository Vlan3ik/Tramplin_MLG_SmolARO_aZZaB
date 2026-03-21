export type SearchSuggestEntityType = 'vacancy' | 'opportunity'

export type SearchSuggestItem = {
  entityType: SearchSuggestEntityType
  id: number
  title: string
  companyName: string
  locationName: string
  publishAt: string | null
  score: number
}

