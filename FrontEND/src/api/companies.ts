import { getJson } from './client'
import type { PagedResponse } from '../types/catalog'
import type { Company, CompanyDetail, CompanyOpportunity, CompanyLink } from '../types/company'
import type { OpportunityType } from '../types/opportunity'
import { formatLabel, typeLabel } from '../types/opportunity'

type CompanyListItemApi = {
  id: number
  name: string | null
  industry: string | null
  verified: boolean
  cityName: string | null
  logoUrl: string | null
  websiteUrl: string | null
  publicEmail: string | null
  activeOpportunitiesCount: number
}

type CompanyLinkApi = {
  kind: string | null
  url: string | null
  label: string | null
}

type CompanyOpportunityApi = {
  id: number
  entityType?: string | null
  title: string | null
  type: string | number | null
  format: string | number | null
  publishAt: string
}

type CompanyDetailApi = {
  id: number
  legalName: string | null
  brandName: string | null
  industry: string | null
  description: string | null
  verified: boolean
  cityName: string | null
  logoUrl: string | null
  websiteUrl: string | null
  publicEmail: string | null
  publicPhone: string | null
  links: CompanyLinkApi[] | null
  activeOpportunities: CompanyOpportunityApi[] | null
}

export type CompaniesQuery = {
  page: number
  pageSize: number
  search?: string
  industry?: string
  verifiedOnly?: boolean
  cityId?: number | null
}

const opportunityTypeByNumber: Record<number, OpportunityType> = {
  1: 'internship',
  2: 'vacancy',
  3: 'mentorship',
  4: 'event',
}

function parseOpportunityType(value: CompanyOpportunityApi['type']): OpportunityType | null {
  if (typeof value === 'number') {
    return opportunityTypeByNumber[value] ?? null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase().trim()

  if (normalized === 'job') return 'vacancy'
  if (normalized === 'hackathon') return 'event'
  if (normalized.includes('vacan')) return 'vacancy'
  if (normalized.includes('intern')) return 'internship'
  if (normalized.includes('ment')) return 'mentorship'
  if (normalized.includes('event') || normalized.includes('career')) return 'event'

  // Back-compat for cases where API returns snake_case keys
  if (normalized === 'vacancy') return 'vacancy'
  if (normalized === 'internship') return 'internship'
  if (normalized === 'mentorship' || normalized === 'mentorshipprogram') return 'mentorship'
  if (normalized === 'careerevent' || normalized === 'event') return 'event'

  return null
}

function parseWorkFormat(value: CompanyOpportunityApi['format']): string | null {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  if (typeof value === 'number') {
    // Swagger enums: 1 = Onsite, 2 = Hybrid, 3 = Remote
    return value === 1 ? 'onsite' : value === 2 ? 'hybrid' : value === 3 ? 'remote' : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase().trim()

  if (normalized.includes('onsite') || normalized === 'office' || normalized === 'office/onsite') {
    return 'onsite'
  }
  if (normalized.includes('hybrid')) return 'hybrid'
  if (normalized.includes('remote')) return 'remote'

  return normalized || null
}

function toCompanyOpportunity(opportunity: CompanyOpportunityApi): CompanyOpportunity {
  const type = parseOpportunityType(opportunity.type)
  const format = parseWorkFormat(opportunity.format)
  const entityType = opportunity.entityType?.toLowerCase().includes('vacancy') ? 'vacancy' : 'opportunity'

  return {
    id: opportunity.id,
    entityType,
    title: opportunity.title,
    type,
    typeLabel: type ? typeLabel[type] : 'Возможность',
    format: format,
    formatLabel: format ? formatLabel[format] : 'Формат не указан',
    publishAt: opportunity.publishAt,
  }
}

function toCompanyLink(link: CompanyLinkApi): CompanyLink {
  return {
    kind: link.kind,
    url: link.url,
    label: link.label,
  }
}

function toCompany(item: CompanyListItemApi): Company {
  return {
    id: item.id,
    name: item.name,
    industry: item.industry,
    verified: item.verified,
    cityName: item.cityName,
    logoUrl: item.logoUrl,
    websiteUrl: item.websiteUrl,
    publicEmail: item.publicEmail,
    activeOpportunitiesCount: item.activeOpportunitiesCount,
  }
}

function buildCompaniesQueryString(query: CompaniesQuery) {
  const params = new URLSearchParams()

  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))

  if (query.search?.trim()) {
    params.set('search', query.search.trim())
  }

  if (query.industry?.trim()) {
    params.set('industry', query.industry.trim())
  }

  if (typeof query.verifiedOnly === 'boolean' && query.verifiedOnly) {
    params.set('verifiedOnly', 'true')
  }

  if (query.cityId) {
    params.set('cityId', String(query.cityId))
  }

  return params.toString()
}

export async function fetchCompanies(query: CompaniesQuery, signal?: AbortSignal): Promise<{ items: Company[]; total: number }> {
  const queryString = buildCompaniesQueryString(query)
  const listResponse = await getJson<PagedResponse<CompanyListItemApi>>(`/companies?${queryString}`, { signal, withAuth: false })

  return {
    items: listResponse.items.map(toCompany),
    total: listResponse.totalCount ?? listResponse.total ?? 0,
  }
}

export async function fetchCompanyById(id: number, signal?: AbortSignal): Promise<CompanyDetail> {
  const response = await getJson<CompanyDetailApi>(`/companies/${id}`, { signal, withAuth: false })

  const displayName = response.brandName ?? response.legalName ?? 'Компания'

  return {
    id: response.id,
    legalName: response.legalName,
    brandName: response.brandName,
    displayName,
    industry: response.industry,
    description: response.description,
    verified: response.verified,
    cityName: response.cityName,
    logoUrl: response.logoUrl,
    websiteUrl: response.websiteUrl,
    publicEmail: response.publicEmail,
    publicPhone: response.publicPhone,
    links: (response.links ?? []).map(toCompanyLink),
    activeOpportunities: (response.activeOpportunities ?? []).map(toCompanyOpportunity),
  }
}

