import { getJson } from './client'
import type { PagedResponse } from '../types/catalog'
import type { Opportunity, OpportunityFilters, OpportunityType } from '../types/opportunity'

type OpportunityTypeApi = string | number

type WorkFormatApi = string | number

type OpportunityListItemApi = {
  id: number
  title: string
  type: OpportunityTypeApi
  format: WorkFormatApi
  companyName: string
  locationName: string
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  publishAt: string
  verifiedCompany: boolean
  tags: string[]
}

type MapOpportunityFeatureApi = {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    id: number
    title: string
    shortDescription: string
    type: OpportunityTypeApi
    format: WorkFormatApi
    publishAt: string
    salaryFrom: number | null
    salaryTo: number | null
    currencyCode: string | null
    company: {
      name: string
      verified: boolean
    }
    location: {
      cityName: string
    }
    tags: string[]
  }
}

type MapOpportunityResponseApi = {
  features?: MapOpportunityFeatureApi[]
}

export type HomeSearchQuery = {
  page?: number
  pageSize?: number
  search?: string
  cityId?: number | null
  filters: OpportunityFilters
}

const opportunityTypeMapping: Record<string, OpportunityType> = {
  internship: 'internship',
  vacancy: 'vacancy',
  mentorshipprogram: 'mentorship',
  mentorship: 'mentorship',
  careerevent: 'event',
  event: 'event',
}

const opportunityTypeByNumber: Record<number, OpportunityType> = {
  1: 'internship',
  2: 'vacancy',
  3: 'mentorship',
  4: 'event',
}

const formatByText: Record<string, string> = {
  onsite: 'onsite',
  hybrid: 'hybrid',
  remote: 'remote',
}

const formatByNumber: Record<number, string> = {
  1: 'onsite',
  2: 'hybrid',
  3: 'remote',
}

const typeQueryToApi: Record<OpportunityType, string> = {
  vacancy: 'Vacancy',
  internship: 'Internship',
  mentorship: 'MentorshipProgram',
  event: 'CareerEvent',
}

const formatQueryToApi: Record<string, string> = {
  onsite: 'Onsite',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

function parseOpportunityType(value: OpportunityTypeApi): OpportunityType {
  if (typeof value === 'number') {
    return opportunityTypeByNumber[value] ?? 'vacancy'
  }

  const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, '')
  return opportunityTypeMapping[normalizedValue] ?? 'vacancy'
}

function parseFormat(value: WorkFormatApi) {
  if (typeof value === 'number') {
    return formatByNumber[value] ?? 'hybrid'
  }

  const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, '')
  return formatByText[normalizedValue] ?? 'hybrid'
}

function formatSalary(min: number | null, max: number | null, currencyCode: string | null) {
  if (min === null && max === null) {
    return 'По договоренности'
  }

  const currency = currencyCode ?? 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU')

  if (min !== null && max !== null) {
    return `${formatter.format(min)} - ${formatter.format(max)} ${currency}`
  }

  if (min !== null) {
    return `от ${formatter.format(min)} ${currency}`
  }

  return `до ${formatter.format(max ?? 0)} ${currency}`
}

function formatRelativeDate(publishAt: string) {
  const publishDate = new Date(publishAt)

  if (Number.isNaN(publishDate.getTime())) {
    return 'Недавно'
  }

  const now = new Date()
  const diffMs = now.getTime() - publishDate.getTime()
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))

  if (diffHours < 24) {
    return `${diffHours} ч назад`
  }

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays <= 7) {
    return `${diffDays} дн назад`
  }

  return publishDate.toLocaleDateString('ru-RU')
}

function toOpportunity(
  apiItem: OpportunityListItemApi,
  coordinates: {
    latitude: number | null
    longitude: number | null
  },
): Opportunity {
  const type = parseOpportunityType(apiItem.type)
  const normalizedFormat = parseFormat(apiItem.format)

  return {
    id: apiItem.id,
    title: apiItem.title,
    type,
    company: apiItem.companyName,
    location: apiItem.locationName,
    compensation: formatSalary(apiItem.salaryFrom, apiItem.salaryTo, apiItem.currencyCode),
    workFormat: normalizedFormat === 'onsite' ? 'Офис' : normalizedFormat === 'remote' ? 'Удаленно' : 'Гибрид',
    date: formatRelativeDate(apiItem.publishAt),
    description: apiItem.tags.length
      ? `Ключевые навыки: ${apiItem.tags.slice(0, 4).join(', ')}.`
      : 'Описание добавляется в карточке вакансии.',
    tags: apiItem.tags,
    verified: apiItem.verifiedCompany,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  }
}

function buildOpportunityQueryString(query: HomeSearchQuery) {
  const params = new URLSearchParams()

  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 24))

  if (query.search?.trim()) {
    params.set('search', query.search.trim())
  }

  if (query.cityId) {
    params.set('cityId', String(query.cityId))
  }

  for (const type of query.filters.types) {
    params.append('types', typeQueryToApi[type])
  }

  for (const format of query.filters.formats) {
    const apiValue = formatQueryToApi[format]

    if (apiValue) {
      params.append('formats', apiValue)
    }
  }

  if (query.filters.verifiedOnly) {
    params.set('verifiedOnly', 'true')
  }

  return params.toString()
}

export async function fetchHomeOpportunities(query: HomeSearchQuery, signal?: AbortSignal) {
  const queryString = buildOpportunityQueryString(query)
  const listResponse = await getJson<PagedResponse<OpportunityListItemApi>>(`/opportunities?${queryString}`, { signal })
  const mapResponse = await getJson<MapOpportunityResponseApi>(`/map/opportunities?${queryString}`, { signal })

  const coordinatesById = new Map<number, { latitude: number | null; longitude: number | null }>()

  for (const feature of mapResponse.features ?? []) {
    if (!feature.properties?.id) {
      continue
    }

    const [longitude, latitude] = feature.geometry?.coordinates ?? [null, null]

    coordinatesById.set(feature.properties.id, {
      latitude,
      longitude,
    })
  }

  const items = listResponse.items.map((item) => {
    const coordinates = coordinatesById.get(item.id) ?? {
      latitude: null,
      longitude: null,
    }

    return toOpportunity(item, coordinates)
  })

  return {
    items,
    total: listResponse.totalCount ?? listResponse.total ?? 0,
  }
}
