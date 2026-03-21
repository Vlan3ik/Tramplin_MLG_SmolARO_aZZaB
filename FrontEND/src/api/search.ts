import type { SearchSuggestItem, SearchSuggestEntityType } from '../types/search'
import { getJson } from './client'

type SearchSuggestResponseApi = {
  query?: string | null
  items?: SearchSuggestItemApi[] | null
}

type SearchSuggestItemApi = {
  entityType?: number | null
  id?: number
  title?: string | null
  companyName?: string | null
  locationName?: string | null
  publishAt?: string | null
  score?: number | null
}

type SearchSuggestParams = {
  q: string
  limit?: number
  types?: SearchSuggestEntityType[]
  signal?: AbortSignal
}

function mapEntityType(value: number | null | undefined): SearchSuggestEntityType {
  return value === 2 ? 'opportunity' : 'vacancy'
}

export async function fetchSearchSuggestions({
  q,
  limit = 10,
  types = ['vacancy', 'opportunity'],
  signal,
}: SearchSuggestParams) {
  const params = new URLSearchParams()
  params.set('q', q.trim())
  params.set('limit', String(limit))

  for (const type of types) {
    params.append('types', type)
  }

  const response = await getJson<SearchSuggestResponseApi>(`/search/suggest?${params.toString()}`, {
    signal,
    withAuth: false,
  })

  const items = (response.items ?? []).map((item): SearchSuggestItem => ({
    entityType: mapEntityType(item.entityType),
    id: item.id ?? 0,
    title: item.title ?? 'Без названия',
    companyName: item.companyName ?? '',
    locationName: item.locationName ?? '',
    publishAt: item.publishAt ?? null,
    score: item.score ?? 0,
  }))

  return {
    query: response.query ?? q,
    items: items.filter((item) => item.id > 0),
  }
}

