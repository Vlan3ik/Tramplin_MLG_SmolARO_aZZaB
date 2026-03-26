import type { City, Location, PagedResponse, TagGroup, TagListItem } from '../types/catalog'
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
  latitude: number | null
  longitude: number | null
  streetName: string | null
  houseNumber: string | null
}

type TagGroupApiItem = {
  id: number
  code: string
  name: string
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

type TagListResponse = TagListItem[] | { items?: TagListItem[] | null }

export async function fetchTags(signal?: AbortSignal) {
  const response = await getJson<TagListResponse>('/catalog/tags', {
    signal,
  })

  if (Array.isArray(response)) {
    return response
  }

  return Array.isArray(response.items) ? response.items : []
}

export async function fetchTagGroups(signal?: AbortSignal) {
  const items = await getJson<TagGroupApiItem[]>('/catalog/tag-groups', {
    signal,
  })

  return items.map(
    (item): TagGroup => ({
      id: item.id,
      code: item.code,
      name: item.name,
    }),
  )
}

export async function fetchTechnologyTags(signal?: AbortSignal) {
  const [tagGroups, tags] = await Promise.all([fetchTagGroups(signal), fetchTags(signal)])
  const technologyGroup = tagGroups.find((item) => item.code === 'technology')

  if (!technologyGroup) {
    return []
  }

  return tags.filter((tag) => tag.groupId === technologyGroup.id || tag.groupCode === technologyGroup.code)
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
        latitude: location.latitude ?? null,
        longitude: location.longitude ?? null,
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
