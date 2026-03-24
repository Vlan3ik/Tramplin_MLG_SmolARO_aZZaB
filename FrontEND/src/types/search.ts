export type SearchSuggestEntityType = 'vacancy' | 'opportunity' | 'profile'

export type SearchSuggestItem = {
  entityType: SearchSuggestEntityType
  id: number
  title: string
  companyName: string
  locationName: string
  username: string | null
  publishAt: string | null
  score: number
}
