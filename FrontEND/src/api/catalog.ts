import type { City, PagedResponse } from '../types/catalog'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://169.254.185.29:1488/api'

type CityApiItem = {
  id: number
  name: string
  region: string
  countryCode: string
  latitude: number | null
  longitude: number | null
}

type ApiErrorPayload = {
  code?: string
  detail?: string
  message?: string
  title?: string
}

function extractApiErrorMessage(payload: ApiErrorPayload | null, status: number) {
  if (payload?.message) {
    return payload.message
  }

  if (payload?.detail) {
    return payload.detail
  }

  if (payload?.title) {
    return payload.title
  }

  if (payload?.code) {
    return `Ошибка API: ${payload.code}`
  }

  return `Ошибка запроса (${status})`
}

async function fetchCitiesPage(page: number, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/catalog/cities?page=${page}&pageSize=100`, {
    method: 'GET',
    signal,
  })

  const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
  const responseBody = isJsonResponse ? ((await response.json()) as PagedResponse<CityApiItem> | ApiErrorPayload) : null

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(responseBody as ApiErrorPayload | null, response.status))
  }

  return responseBody as PagedResponse<CityApiItem>
}

export async function fetchCities(signal?: AbortSignal) {
  const items: City[] = []
  let page = 1
  let total = 0

  do {
    const response = await fetchCitiesPage(page, signal)
    total = response.total
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
