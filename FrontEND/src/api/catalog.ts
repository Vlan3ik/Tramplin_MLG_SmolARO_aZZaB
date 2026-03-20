import type { City, Location, PagedResponse, TagListItem } from '../types/catalog'
import { getJson } from './client'

type CityApiItem = {
  id: number
  name: string
  region: string
  countryCode: string
  latitude: number | null
  longitude: number | null
}

type LocationApiItem = {
  id: number
  cityId: number
  cityName: string | null
  streetName: string | null
  houseNumber: string | null
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

async function fetchLocationsPage(page: number, cityId?: number, signal?: AbortSignal) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', '100')

  if (cityId) {
    params.set('cityId', String(cityId))
  }

  return getJson<PagedResponse<LocationApiItem>>(`/catalog/locations?${params.toString()}`, {
    signal,
  })
}

export async function fetchLocations(cityId?: number, signal?: AbortSignal) {
  const items: Location[] = []
  let page = 1
  let total = 0

  do {
    const response = await fetchLocationsPage(page, cityId, signal)
    total = response.totalCount ?? response.total ?? 0
    const pageItems = response.items ?? []
    items.push(
      ...pageItems.map((location) => ({
        id: location.id,
        cityId: location.cityId,
        cityName: location.cityName ?? '',
        streetName: location.streetName ?? '',
        houseNumber: location.houseNumber ?? '',
      })),
    )
    if (pageItems.length === 0) {
      break
    }
    page += 1
  } while (items.length < total)

  return items
}
