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
  username?: string | null
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
  if (value === 2) {
    return 'opportunity'
  }

  if (value === 3) {
    return 'profile'
  }

  return 'vacancy'
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
    username: item.username ?? null,
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

export async function fetchVacancyCollaborationSuggestions(q: string, signal?: AbortSignal) {
  const query = q.trim()
  if (query.length < 2) {
    return { query, items: [] as SearchSuggestItem[] }
  }

  const params = new URLSearchParams()
  params.set('q', query)
  params.set('limit', '10')

  let response: SearchSuggestResponseApi
  try {
    response = await getJson<SearchSuggestResponseApi>(`/search/suggest/vacancies?${params.toString()}`, {
      signal,
      withAuth: false,
    })
  } catch {
    return fetchSearchSuggestions({
      q: query,
      limit: 10,
      types: ['vacancy'],
      signal,
    })
  }

  const items = (response.items ?? []).map((item): SearchSuggestItem => ({
    entityType: 'vacancy',
    id: item.id ?? 0,
    title: item.title ?? 'Без названия',
    username: null,
    companyName: item.companyName ?? '',
    locationName: item.locationName ?? '',
    publishAt: item.publishAt ?? null,
    score: item.score ?? 0,
  }))

  return {
    query: response.query ?? query,
    items: items.filter((item) => item.id > 0),
  }
}

export async function fetchOpportunityCollaborationSuggestions(q: string, signal?: AbortSignal) {
  const query = q.trim()
  if (query.length < 2) {
    return { query, items: [] as SearchSuggestItem[] }
  }

  const params = new URLSearchParams()
  params.set('q', query)
  params.set('limit', '10')

  let response: SearchSuggestResponseApi
  try {
    response = await getJson<SearchSuggestResponseApi>(`/search/suggest/opportunities?${params.toString()}`, {
      signal,
      withAuth: false,
    })
  } catch {
    return fetchSearchSuggestions({
      q: query,
      limit: 10,
      types: ['opportunity'],
      signal,
    })
  }

  const items = (response.items ?? []).map((item): SearchSuggestItem => ({
    entityType: 'opportunity',
    id: item.id ?? 0,
    title: item.title ?? 'Без названия',
    username: null,
    companyName: item.companyName ?? '',
    locationName: item.locationName ?? '',
    publishAt: item.publishAt ?? null,
    score: item.score ?? 0,
  }))

  return {
    query: response.query ?? query,
    items: items.filter((item) => item.id > 0),
  }
}

export async function fetchProfileCollaborationSuggestions(q: string, signal?: AbortSignal) {
  const query = q.trim()
  if (query.length < 1) {
    return { query, items: [] as SearchSuggestItem[] }
  }

  const params = new URLSearchParams()
  params.set('q', query)
  params.set('limit', '10')

  let response: SearchSuggestResponseApi
  try {
    response = await getJson<SearchSuggestResponseApi>(`/search/suggest/profiles?${params.toString()}`, {
      signal,
      withAuth: false,
    })
  } catch {
    return fetchSearchSuggestions({
      q: query,
      limit: 10,
      types: ['profile'],
      signal,
    })
  }

  const items = (response.items ?? []).map((item): SearchSuggestItem => ({
    entityType: 'profile',
    id: item.id ?? 0,
    title: item.title ?? (item.username ?? 'Без названия'),
    username: item.username ?? null,
    companyName: '',
    locationName: '',
    publishAt: item.publishAt ?? null,
    score: item.score ?? 0,
  }))

  return {
    query: response.query ?? query,
    items: items.filter((item) => item.id > 0),
  }
}
