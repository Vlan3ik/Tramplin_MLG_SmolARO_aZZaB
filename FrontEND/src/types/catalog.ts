export type City = {
  id: number
  name: string
  region: string
  countryCode: string
  latitude: number | null
  longitude: number | null
}

export type PagedResponse<T> = {
  items: T[]
  totalCount: number
  total?: number
  page: number
  pageSize: number
}

export type TagListItem = {
  id: number
  groupId: number
  groupCode: string
  name: string
  slug: string
}

export type Location = {
  id: number
  cityId: number
  cityName: string
  streetName: string
  houseNumber: string
}
