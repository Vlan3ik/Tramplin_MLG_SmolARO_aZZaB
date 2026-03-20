import { getJson, postJson } from './client'
import type { PagedResponse } from '../types/catalog'
import type { Opportunity, OpportunityDetail, OpportunityFilters, OpportunityType } from '../types/opportunity'

type KindApi = string | number | null | undefined
type WorkFormatApi = string | number | null | undefined

type VacancyListItemApi = {
  id: number
  title: string | null
  kind?: KindApi
  type?: KindApi
  format?: WorkFormatApi
  companyName?: string | null
  locationName?: string | null
  salaryFrom?: number | null
  salaryTo?: number | null
  currencyCode?: string | null
  publishAt?: string
  verifiedCompany?: boolean
  tags?: string[] | null
}

type OpportunityListItemApi = {
  id: number
  title: string | null
  kind?: KindApi
  format?: WorkFormatApi
  companyName?: string | null
  locationName?: string | null
  priceType?: string | number | null
  priceAmount?: number | null
  priceCurrencyCode?: string | null
  publishAt?: string
  verifiedCompany?: boolean
  participantsCanWrite?: boolean
  tags?: string[] | null
}

type VacancyDetailApi = {
  id: number
  title: string | null
  shortDescription?: string | null
  fullDescription?: string | null
  kind?: KindApi
  type?: KindApi
  format?: WorkFormatApi
  publishAt?: string
  applicationDeadline?: string | null
  salaryFrom?: number | null
  salaryTo?: number | null
  currencyCode?: string | null
  company?: {
    id: number
    name: string | null
    verified: boolean
    websiteUrl: string | null
    publicEmail: string | null
  } | null
  location?: {
    cityName?: string | null
    latitude?: number | null
    longitude?: number | null
    streetName?: string | null
    street?: string | null
    houseNumber?: string | null
  } | null
  tags?: string[] | null
}

type OpportunityDetailApi = {
  id: number
  title: string | null
  shortDescription?: string | null
  fullDescription?: string | null
  kind?: KindApi
  type?: KindApi
  format?: WorkFormatApi
  publishAt?: string
  eventDate?: string | null
  priceType?: string | number | null
  priceAmount?: number | null
  priceCurrencyCode?: string | null
  isParticipating?: boolean
  company?: {
    id: number
    name: string | null
    verified: boolean
    websiteUrl: string | null
    publicEmail: string | null
  } | null
  location?: {
    cityName?: string | null
    latitude?: number | null
    longitude?: number | null
    streetName?: string | null
    street?: string | null
    houseNumber?: string | null
  } | null
  tags?: string[] | null
}

type MapOpportunityFeatureApi = {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    id?: number
    entityType?: string | number | null
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

function parseOpportunityType(value: KindApi): OpportunityType {
  if (typeof value === 'number') {
    // VacancyKind in new API: 1 = Internship, 2 = Job.
    if (value === 1) return 'internship'
    if (value === 2) return 'vacancy'

    // Back-compat with older OpportunityType enum.
    if (value === 3) return 'mentorship'
    if (value === 4) return 'event'

    return 'vacancy'
  }

  if (typeof value !== 'string') {
    return 'vacancy'
  }

  const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, '')

  if (normalizedValue.includes('intern')) return 'internship'
  if (normalizedValue.includes('job') || normalizedValue.includes('vacan')) return 'vacancy'
  if (normalizedValue.includes('ment')) return 'mentorship'
  if (normalizedValue.includes('event') || normalizedValue.includes('hackathon') || normalizedValue.includes('lecture') || normalizedValue.includes('openday') || normalizedValue.includes('other')) {
    return 'event'
  }

  return 'vacancy'
}

function parseFormat(value: WorkFormatApi) {
  if (typeof value === 'number') {
    return formatByNumber[value] ?? 'hybrid'
  }

  if (typeof value !== 'string') {
    return 'hybrid'
  }

  const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, '')
  return formatByText[normalizedValue] ?? 'hybrid'
}

function formatSalary(min: number | null | undefined, max: number | null | undefined, currencyCode: string | null | undefined) {
  if (min == null && max == null) {
    return 'По договоренности'
  }

  const currency = currencyCode ?? 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU')

  if (min != null && max != null) {
    return `${formatter.format(min)} - ${formatter.format(max)} ${currency}`
  }

  if (min != null) {
    return `от ${formatter.format(min)} ${currency}`
  }

  return `до ${formatter.format(max ?? 0)} ${currency}`
}

function formatPrice(priceType: string | number | null | undefined, amount: number | null | undefined, currencyCode: string | null | undefined) {
  if (typeof priceType === 'number') {
    if (priceType === 1) return 'Бесплатно'
    if (priceType === 2 && amount != null) return `Платно: ${new Intl.NumberFormat('ru-RU').format(amount)} ${currencyCode ?? 'RUB'}`
    if (priceType === 3 && amount != null) return `Приз: ${new Intl.NumberFormat('ru-RU').format(amount)} ${currencyCode ?? 'RUB'}`
  }

  if (typeof priceType === 'string') {
    const normalized = priceType.toLowerCase()
    if (normalized.includes('free')) return 'Бесплатно'
    if (normalized.includes('paid') && amount != null) return `Платно: ${new Intl.NumberFormat('ru-RU').format(amount)} ${currencyCode ?? 'RUB'}`
    if (normalized.includes('prize') && amount != null) return `Приз: ${new Intl.NumberFormat('ru-RU').format(amount)} ${currencyCode ?? 'RUB'}`
  }

  return amount != null ? `${new Intl.NumberFormat('ru-RU').format(amount)} ${currencyCode ?? 'RUB'}` : 'Условия уточняются'
}

function formatRelativeDate(publishAt: string | undefined) {
  if (!publishAt) {
    return 'Недавно'
  }

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

function toOpportunityFromVacancy(apiItem: VacancyListItemApi, coordinates: { latitude: number | null; longitude: number | null }): Opportunity {
  const kind = apiItem.kind ?? apiItem.type
  const type = parseOpportunityType(kind)
  const normalizedFormat = parseFormat(apiItem.format)

  return {
    id: apiItem.id,
    title: apiItem.title ?? 'Без названия',
    type,
    company: apiItem.companyName ?? 'Компания',
    location: apiItem.locationName ?? 'Локация не указана',
    compensation: formatSalary(apiItem.salaryFrom, apiItem.salaryTo, apiItem.currencyCode),
    workFormat: normalizedFormat === 'onsite' ? 'Офис' : normalizedFormat === 'remote' ? 'Удаленно' : 'Гибрид',
    date: formatRelativeDate(apiItem.publishAt),
    description: (apiItem.tags ?? []).length
      ? `Ключевые навыки: ${(apiItem.tags ?? []).slice(0, 4).join(', ')}.`
      : 'Описание добавляется в карточке вакансии.',
    tags: apiItem.tags ?? [],
    verified: Boolean(apiItem.verifiedCompany),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  }
}

function toOpportunityFromOpportunity(
  apiItem: OpportunityListItemApi,
  coordinates: {
    latitude: number | null
    longitude: number | null
  },
): Opportunity {
  const type = parseOpportunityType(apiItem.kind)
  const normalizedFormat = parseFormat(apiItem.format)

  return {
    id: apiItem.id,
    title: apiItem.title ?? 'Р‘РµР· РЅР°Р·РІР°РЅРёСЏ',
    type: type === 'vacancy' ? 'event' : type,
    company: apiItem.companyName ?? 'РљРѕРјРїР°РЅРёСЏ',
    location: apiItem.locationName ?? 'Р›РѕРєР°С†РёСЏ РЅРµ СѓРєР°Р·Р°РЅР°',
    compensation: formatPrice(apiItem.priceType, apiItem.priceAmount, apiItem.priceCurrencyCode),
    workFormat: normalizedFormat === 'onsite' ? 'РћС„РёСЃ' : normalizedFormat === 'remote' ? 'РЈРґР°Р»РµРЅРЅРѕ' : 'Р“РёР±СЂРёРґ',
    date: formatRelativeDate(apiItem.publishAt),
    description: (apiItem.tags ?? []).length
      ? `РљР»СЋС‡РµРІС‹Рµ С‚РµРіРё: ${(apiItem.tags ?? []).slice(0, 4).join(', ')}.`
      : 'РћРїРёСЃР°РЅРёРµ РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РІ РєР°СЂС‚РѕС‡РєРµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.',
    tags: apiItem.tags ?? [],
    verified: Boolean(apiItem.verifiedCompany),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  }
}

function parseMapEntityType(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    return value === 1 ? 'vacancy' : value === 2 ? 'opportunity' : null
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized.includes('vacancy')) return 'vacancy'
    if (normalized.includes('opportunity')) return 'opportunity'
  }

  return null
}

function mapKeyFor(entityType: 'vacancy' | 'opportunity', id: number) {
  return `${entityType}:${id}`
}

function buildVacanciesQueryString(query: HomeSearchQuery) {
  const params = new URLSearchParams()

  params.set('Page', String(query.page ?? 1))
  params.set('PageSize', String(query.pageSize ?? 24))

  if (query.search?.trim()) {
    params.set('Search', query.search.trim())
  }

  if (query.cityId) {
    params.set('CityId', String(query.cityId))
  }

  const hasInternship = query.filters.types.includes('internship')
  const hasVacancy = query.filters.types.includes('vacancy')

  if (!query.filters.types.length || hasInternship || hasVacancy) {
    if (!query.filters.types.length || hasInternship) {
      params.append('Kinds', '1')
    }

    if (!query.filters.types.length || hasVacancy) {
      params.append('Kinds', '2')
    }
  }

  for (const format of query.filters.formats) {
    if (format === 'onsite') params.append('Formats', '1')
    if (format === 'hybrid') params.append('Formats', '2')
    if (format === 'remote') params.append('Formats', '3')
  }

  if (query.filters.verifiedOnly) {
    params.set('VerifiedOnly', 'true')
  }

  return params.toString()
}

function buildOpportunitiesQueryString(query: HomeSearchQuery) {
  const params = new URLSearchParams()

  params.set('Page', String(query.page ?? 1))
  params.set('PageSize', String(query.pageSize ?? 24))

  if (query.search?.trim()) {
    params.set('Search', query.search.trim())
  }

  if (query.cityId) {
    params.set('CityId', String(query.cityId))
  }

  const hasEvent = query.filters.types.includes('event')
  const hasMentorship = query.filters.types.includes('mentorship')

  if (!query.filters.types.length || hasEvent || hasMentorship) {
    params.append('Kinds', '1')
    params.append('Kinds', '2')
    params.append('Kinds', '3')
    params.append('Kinds', '4')
  }

  for (const format of query.filters.formats) {
    if (format === 'onsite') params.append('Formats', '1')
    if (format === 'hybrid') params.append('Formats', '2')
    if (format === 'remote') params.append('Formats', '3')
  }

  if (query.filters.verifiedOnly) {
    params.set('VerifiedOnly', 'true')
  }

  return params.toString()
}

function buildMapQueryString(query: HomeSearchQuery) {
  const params = new URLSearchParams()

  if (query.search?.trim()) {
    params.set('Search', query.search.trim())
  }

  if (query.cityId) {
    params.set('CityId', String(query.cityId))
  }

  params.append('EntityTypes', '1')
  params.append('EntityTypes', '2')

  const hasInternship = query.filters.types.includes('internship')
  const hasVacancy = query.filters.types.includes('vacancy')

  if (!query.filters.types.length || hasInternship || hasVacancy) {
    if (!query.filters.types.length || hasInternship) {
      params.append('VacancyKinds', '1')
    }

    if (!query.filters.types.length || hasVacancy) {
      params.append('VacancyKinds', '2')
    }
  }

  const hasEvent = query.filters.types.includes('event')
  const hasMentorship = query.filters.types.includes('mentorship')

  if (!query.filters.types.length || hasEvent || hasMentorship) {
    params.append('OpportunityKinds', '1')
    params.append('OpportunityKinds', '2')
    params.append('OpportunityKinds', '3')
    params.append('OpportunityKinds', '4')
  }

  for (const format of query.filters.formats) {
    if (format === 'onsite') params.append('Formats', '1')
    if (format === 'hybrid') params.append('Formats', '2')
    if (format === 'remote') params.append('Formats', '3')
  }

  if (query.filters.verifiedOnly) {
    params.set('VerifiedOnly', 'true')
  }

  return params.toString()
}

export async function fetchHomeOpportunities(query: HomeSearchQuery, signal?: AbortSignal) {
  const queryString = buildVacanciesQueryString(query)
  const opportunitiesQueryString = buildOpportunitiesQueryString(query)
  const mapQueryString = buildMapQueryString(query)
  const [vacanciesResponse, opportunitiesResponse, mapResponse] = await Promise.all([
    getJson<PagedResponse<VacancyListItemApi>>(`/vacancies?${queryString}`, { signal, withAuth: false }),
    getJson<PagedResponse<OpportunityListItemApi>>(`/opportunities?${opportunitiesQueryString}`, { signal, withAuth: false }),
    getJson<MapOpportunityResponseApi>(`/map/opportunities?${mapQueryString}`, { signal, withAuth: false }),
  ])

  const coordinatesByEntityKey = new Map<string, { latitude: number | null; longitude: number | null }>()

  for (const feature of mapResponse.features ?? []) {
    if (!feature.properties?.id) {
      continue
    }

    const entityType = parseMapEntityType(feature.properties.entityType)
    if (!entityType) {
      continue
    }

    const [longitude, latitude] = feature.geometry?.coordinates ?? [null, null]

    coordinatesByEntityKey.set(mapKeyFor(entityType, feature.properties.id), {
      latitude,
      longitude,
    })
  }

  const vacancyItems = (vacanciesResponse.items ?? []).map((item) => {
    const coordinates = coordinatesByEntityKey.get(mapKeyFor('vacancy', item.id)) ?? {
      latitude: null,
      longitude: null,
    }

    return toOpportunityFromVacancy(item, coordinates)
  })

  const opportunityItems = (opportunitiesResponse.items ?? []).map((item) => {
    const coordinates = coordinatesByEntityKey.get(mapKeyFor('opportunity', item.id)) ?? {
      latitude: null,
      longitude: null,
    }

    return toOpportunityFromOpportunity(item, coordinates)
  })

  const items = [...vacancyItems, ...opportunityItems].sort((a, b) => b.id - a.id)

  return {
    items,
    total: (vacanciesResponse.totalCount ?? vacanciesResponse.total ?? 0) + (opportunitiesResponse.totalCount ?? opportunitiesResponse.total ?? 0),
  }
}

function mapFromVacancyDetail(response: VacancyDetailApi): OpportunityDetail {
  const kind = response.kind ?? response.type
  const type = parseOpportunityType(kind)
  const normalizedFormat = parseFormat(response.format)

  return {
    id: response.id,
    title: response.title ?? 'Без названия',
    type,
    company: response.company?.name ?? 'Компания',
    location: response.location?.cityName ?? 'Локация не указана',
    compensation: formatSalary(response.salaryFrom, response.salaryTo, response.currencyCode),
    workFormat: normalizedFormat === 'onsite' ? 'Офис' : normalizedFormat === 'remote' ? 'Удаленно' : 'Гибрид',
    date: formatRelativeDate(response.publishAt),
    description: response.shortDescription ?? response.fullDescription ?? 'Описание добавляется в карточке вакансии.',
    shortDescription: response.shortDescription ?? '',
    fullDescription: response.fullDescription ?? '',
    publishAt: response.publishAt ?? null,
    applicationDeadline: response.applicationDeadline ?? null,
    isParticipating: false,
    tags: response.tags ?? [],
    verified: response.company?.verified ?? false,
    latitude: response.location?.latitude ?? null,
    longitude: response.location?.longitude ?? null,
    companyId: response.company?.id ?? null,
    companyWebsiteUrl: response.company?.websiteUrl ?? null,
    companyPublicEmail: response.company?.publicEmail ?? null,
    address: toAddress(response.location),
  }
}

function mapFromOpportunityDetail(response: OpportunityDetailApi): OpportunityDetail {
  const kind = response.kind ?? response.type
  const normalizedFormat = parseFormat(response.format)

  return {
    id: response.id,
    title: response.title ?? 'Без названия',
    type: parseOpportunityType(kind) === 'vacancy' ? 'event' : parseOpportunityType(kind),
    company: response.company?.name ?? 'Компания',
    location: response.location?.cityName ?? 'Локация не указана',
    compensation: formatPrice(response.priceType, response.priceAmount, response.priceCurrencyCode),
    workFormat: normalizedFormat === 'onsite' ? 'Офис' : normalizedFormat === 'remote' ? 'Удаленно' : 'Гибрид',
    date: formatRelativeDate(response.publishAt),
    description: response.shortDescription ?? response.fullDescription ?? 'Описание добавляется в карточке возможности.',
    shortDescription: response.shortDescription ?? '',
    fullDescription: response.fullDescription ?? '',
    publishAt: response.publishAt ?? null,
    applicationDeadline: response.eventDate ?? null,
    isParticipating: Boolean(response.isParticipating),
    tags: response.tags ?? [],
    verified: response.company?.verified ?? false,
    latitude: response.location?.latitude ?? null,
    longitude: response.location?.longitude ?? null,
    companyId: response.company?.id ?? null,
    companyWebsiteUrl: response.company?.websiteUrl ?? null,
    companyPublicEmail: response.company?.publicEmail ?? null,
    address: toAddress(response.location),
  }
}

function isProbablyNotFoundError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('404') || message.includes('not found') || message.includes('не найден')
}

export async function fetchOpportunityById(id: number, signal?: AbortSignal): Promise<Opportunity> {
  const detail = await fetchOpportunityDetailById(id, signal)

  return {
    id: detail.id,
    title: detail.title,
    type: detail.type,
    company: detail.company,
    location: detail.location,
    compensation: detail.compensation,
    workFormat: detail.workFormat,
    date: detail.date,
    description: detail.description,
    tags: detail.tags,
    verified: detail.verified,
    latitude: detail.latitude ?? null,
    longitude: detail.longitude ?? null,
  }
}

function toAddress(location: VacancyDetailApi['location'] | OpportunityDetailApi['location']) {
  if (!location) {
    return 'Адрес не указан'
  }

  const street = location.streetName ?? location.street ?? null
  const parts = [location.cityName, street, location.houseNumber].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Адрес не указан'
}

export async function fetchOpportunityDetailById(id: number, signal?: AbortSignal): Promise<OpportunityDetail> {
  try {
    const vacancyResponse = await getJson<VacancyDetailApi>(`/vacancies/${id}`, { signal, withAuth: false })
    return mapFromVacancyDetail(vacancyResponse)
  } catch (vacancyError) {
    if (!isProbablyNotFoundError(vacancyError)) {
      throw vacancyError
    }
  }

  const opportunityResponse = await getJson<OpportunityDetailApi>(`/opportunities/${id}`, { signal, withAuth: false })
  return mapFromOpportunityDetail(opportunityResponse)
}

export function participateInOpportunity(id: number) {
  return postJson<unknown, Record<string, never>>(`/opportunities/${id}/participation`, {})
}
