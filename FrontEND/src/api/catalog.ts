import type { City, PagedResponse, TagListItem } from '../types/catalog'
import { getJson } from './client'

type CityApiItem = {
  id: number
  name: string
  region: string
  countryCode: string
  latitude: number | null
  longitude: number | null
}

async function fetchCitiesPage(page: number, signal?: AbortSignal) {
  return getJson<PagedResponse<CityApiItem>>(`/catalog/cities?page=${page}&pageSize=100`, {
    signal,
  })
}

export async function fetchCities(signal?: AbortSignal) {
  const items: City[] = []
  let page = 1
  let total = 0

  do {
    const response = await fetchCitiesPage(page, signal)
    total = response.totalCount ?? response.total ?? 0
    items.push(
      ...response.items.map((city) => ({
        id: city.id,
        name: city.name,
        region: city.region,
        countryCode: city.countryCode,
        latitude: city.latitude,
        longitude: city.longitude,
      })),
    )
    page += 1
  } while (items.length < total)

  return items
}

export function fetchTags(signal?: AbortSignal) {
  return getJson<TagListItem[]>('/catalog/tags', {
    signal,
  })
}
