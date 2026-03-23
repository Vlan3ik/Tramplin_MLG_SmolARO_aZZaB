import { deleteJson, getJson, postJson, putJson } from './client'

type PagedResponse<TItem> = {
  items?: TItem[] | null
  totalCount?: number
  page?: number
  pageSize?: number
}

type AdminUserApi = {
  id: number
  email: string
  username: string
  status: number | string
  roles: string[] | null
  createdAt: string
}

type AdminCompanyApi = {
  id: number
  legalName: string
  brandName: string | null
  status: number | string
  baseCityId: number
  industry: string
  createdAt: string
}

type AdminVacancyApi = {
  id: number
  companyId: number
  title: string
  status: number | string
  kind: number | string
  format: number | string
  publishAt: string
}

type AdminOpportunityApi = {
  id: number
  companyId: number
  title: string
  status: number | string
  kind: number | string
  format: number | string
  publishAt: string
}

type AdminUserUpsertApiRequest = {
  email: string
  firstName: string
  lastName: string
  status: number
  roles: number[]
}

type AdminCompanyUpsertApiRequest = {
  legalName: string
  brandName: string | null
  legalType: number
  taxId: string
  registrationNumber: string
  industry: string
  description: string
  baseCityId: number
  websiteUrl: string | null
  publicEmail: string | null
  publicPhone: string | null
  status: number
}

type AdminVacancyUpsertApiRequest = {
  companyId: number
  createdByUserId: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  locationId: number | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  salaryTaxMode: number
  publishAt: string
  applicationDeadline: string | null
}

type AdminOpportunityUpsertApiRequest = {
  companyId: number
  createdByUserId: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  locationId: number | null
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
  participantsCanWrite: boolean
  publishAt: string
  eventDate: string | null
}

export type AdminUser = {
  id: number
  email: string
  username: string
  status: number
  roles: string[]
  createdAt: string
}

export type AdminCompany = {
  id: number
  legalName: string
  brandName: string
  status: number
  baseCityId: number
  industry: string
  createdAt: string
}

export type AdminVacancy = {
  id: number
  companyId: number
  title: string
  status: number
  kind: number
  format: number
  publishAt: string
}

export type AdminOpportunity = {
  id: number
  companyId: number
  title: string
  status: number
  kind: number
  format: number
  publishAt: string
}

export type AdminUserUpsertRequest = {
  email: string
  firstName: string
  lastName: string
  status: number
  roles: number[]
}

export type AdminCompanyUpsertRequest = {
  legalName: string
  brandName: string
  legalType: number
  taxId: string
  registrationNumber: string
  industry: string
  description: string
  baseCityId: number
  websiteUrl: string
  publicEmail: string
  publicPhone: string
  status: number
}

export type AdminVacancyUpsertRequest = {
  companyId: number
  createdByUserId: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  locationId: number | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  salaryTaxMode: number
  publishAt: string
  applicationDeadline: string | null
}

export type AdminOpportunityUpsertRequest = {
  companyId: number
  createdByUserId: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  locationId: number | null
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
  participantsCanWrite: boolean
  publishAt: string
  eventDate: string | null
}

function parseEnum(value: number | string) {
  if (typeof value === 'number') {
    return value
  }

  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : 0
}

function toNullableString(value: string) {
  const normalized = value.trim()
  return normalized ? normalized : null
}

function mapUser(item: AdminUserApi): AdminUser {
  return {
    id: item.id,
    email: item.email ?? '',
    username: item.username ?? '',
    status: parseEnum(item.status),
    roles: item.roles ?? [],
    createdAt: item.createdAt,
  }
}

function mapCompany(item: AdminCompanyApi): AdminCompany {
  return {
    id: item.id,
    legalName: item.legalName ?? '',
    brandName: item.brandName ?? '',
    status: parseEnum(item.status),
    baseCityId: item.baseCityId ?? 0,
    industry: item.industry ?? '',
    createdAt: item.createdAt,
  }
}

function mapVacancy(item: AdminVacancyApi): AdminVacancy {
  return {
    id: item.id,
    companyId: item.companyId,
    title: item.title ?? '',
    status: parseEnum(item.status),
    kind: parseEnum(item.kind),
    format: parseEnum(item.format),
    publishAt: item.publishAt,
  }
}

function mapOpportunity(item: AdminOpportunityApi): AdminOpportunity {
  return {
    id: item.id,
    companyId: item.companyId,
    title: item.title ?? '',
    status: parseEnum(item.status),
    kind: parseEnum(item.kind),
    format: parseEnum(item.format),
    publishAt: item.publishAt,
  }
}

function mapUserUpsertRequest(payload: AdminUserUpsertRequest): AdminUserUpsertApiRequest {
  return {
    email: payload.email.trim(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    status: payload.status,
    roles: payload.roles,
  }
}

function mapCompanyUpsertRequest(payload: AdminCompanyUpsertRequest): AdminCompanyUpsertApiRequest {
  return {
    legalName: payload.legalName.trim(),
    brandName: toNullableString(payload.brandName),
    legalType: payload.legalType,
    taxId: payload.taxId.trim(),
    registrationNumber: payload.registrationNumber.trim(),
    industry: payload.industry.trim(),
    description: payload.description.trim(),
    baseCityId: payload.baseCityId,
    websiteUrl: toNullableString(payload.websiteUrl),
    publicEmail: toNullableString(payload.publicEmail),
    publicPhone: toNullableString(payload.publicPhone),
    status: payload.status,
  }
}

function mapVacancyUpsertRequest(payload: AdminVacancyUpsertRequest): AdminVacancyUpsertApiRequest {
  return {
    companyId: payload.companyId,
    createdByUserId: payload.createdByUserId,
    title: payload.title.trim(),
    shortDescription: payload.shortDescription.trim(),
    fullDescription: payload.fullDescription.trim(),
    kind: payload.kind,
    format: payload.format,
    status: payload.status,
    cityId: payload.cityId,
    locationId: payload.locationId,
    salaryFrom: payload.salaryFrom,
    salaryTo: payload.salaryTo,
    currencyCode: payload.currencyCode?.trim() || null,
    salaryTaxMode: payload.salaryTaxMode,
    publishAt: payload.publishAt,
    applicationDeadline: payload.applicationDeadline,
  }
}

function mapOpportunityUpsertRequest(payload: AdminOpportunityUpsertRequest): AdminOpportunityUpsertApiRequest {
  return {
    companyId: payload.companyId,
    createdByUserId: payload.createdByUserId,
    title: payload.title.trim(),
    shortDescription: payload.shortDescription.trim(),
    fullDescription: payload.fullDescription.trim(),
    kind: payload.kind,
    format: payload.format,
    status: payload.status,
    cityId: payload.cityId,
    locationId: payload.locationId,
    priceType: payload.priceType,
    priceAmount: payload.priceAmount,
    priceCurrencyCode: payload.priceCurrencyCode?.trim() || null,
    participantsCanWrite: payload.participantsCanWrite,
    publishAt: payload.publishAt,
    eventDate: payload.eventDate,
  }
}

type FetchListOptions = {
  page?: number
  pageSize?: number
  search?: string
  signal?: AbortSignal
}

function buildListQuery(options: FetchListOptions) {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  params.set('pageSize', String(options.pageSize ?? 20))
  if (options.search?.trim()) {
    params.set('search', options.search.trim())
  }
  return params.toString()
}

export async function fetchAdminUsers(options: FetchListOptions = {}) {
  const response = await getJson<PagedResponse<AdminUserApi>>(`/admin/users?${buildListQuery(options)}`, { signal: options.signal })
  return {
    items: (response.items ?? []).map(mapUser),
    totalCount: response.totalCount ?? 0,
  }
}

export function createAdminUser(payload: AdminUserUpsertRequest) {
  return postJson<AdminUserApi, AdminUserUpsertApiRequest>('/admin/users', mapUserUpsertRequest(payload))
}

export function updateAdminUser(id: number, payload: AdminUserUpsertRequest) {
  return putJson<AdminUserApi, AdminUserUpsertApiRequest>(`/admin/users/${id}`, mapUserUpsertRequest(payload))
}

export function deleteAdminUser(id: number) {
  return deleteJson<unknown>(`/admin/users/${id}`)
}

export async function fetchAdminCompanies(options: FetchListOptions = {}) {
  const response = await getJson<PagedResponse<AdminCompanyApi>>(`/admin/companies?${buildListQuery(options)}`, { signal: options.signal })
  return {
    items: (response.items ?? []).map(mapCompany),
    totalCount: response.totalCount ?? 0,
  }
}

export function createAdminCompany(payload: AdminCompanyUpsertRequest) {
  return postJson<AdminCompanyApi, AdminCompanyUpsertApiRequest>('/admin/companies', mapCompanyUpsertRequest(payload))
}

export function updateAdminCompany(id: number, payload: AdminCompanyUpsertRequest) {
  return putJson<AdminCompanyApi, AdminCompanyUpsertApiRequest>(`/admin/companies/${id}`, mapCompanyUpsertRequest(payload))
}

export function deleteAdminCompany(id: number) {
  return deleteJson<unknown>(`/admin/companies/${id}`)
}

export function verifyAdminCompany(id: number) {
  return postJson<unknown, Record<string, never>>(`/admin/companies/${id}/verify`, {})
}

export function rejectAdminCompany(id: number) {
  return postJson<unknown, Record<string, never>>(`/admin/companies/${id}/reject`, {})
}

export async function fetchAdminVacancies(options: FetchListOptions = {}) {
  const response = await getJson<PagedResponse<AdminVacancyApi>>(`/admin/vacancies?${buildListQuery(options)}`, { signal: options.signal })
  return {
    items: (response.items ?? []).map(mapVacancy),
    totalCount: response.totalCount ?? 0,
  }
}

export function createAdminVacancy(payload: AdminVacancyUpsertRequest) {
  return postJson<AdminVacancyApi, AdminVacancyUpsertApiRequest>('/admin/vacancies', mapVacancyUpsertRequest(payload))
}

export function updateAdminVacancy(id: number, payload: AdminVacancyUpsertRequest) {
  return putJson<AdminVacancyApi, AdminVacancyUpsertApiRequest>(`/admin/vacancies/${id}`, mapVacancyUpsertRequest(payload))
}

export function deleteAdminVacancy(id: number) {
  return deleteJson<unknown>(`/admin/vacancies/${id}`)
}

export async function fetchAdminOpportunities(options: FetchListOptions = {}) {
  const response = await getJson<PagedResponse<AdminOpportunityApi>>(`/admin/opportunities?${buildListQuery(options)}`, { signal: options.signal })
  return {
    items: (response.items ?? []).map(mapOpportunity),
    totalCount: response.totalCount ?? 0,
  }
}

export function createAdminOpportunity(payload: AdminOpportunityUpsertRequest) {
  return postJson<AdminOpportunityApi, AdminOpportunityUpsertApiRequest>('/admin/opportunities', mapOpportunityUpsertRequest(payload))
}

export function updateAdminOpportunity(id: number, payload: AdminOpportunityUpsertRequest) {
  return putJson<AdminOpportunityApi, AdminOpportunityUpsertApiRequest>(`/admin/opportunities/${id}`, mapOpportunityUpsertRequest(payload))
}

export function deleteAdminOpportunity(id: number) {
  return deleteJson<unknown>(`/admin/opportunities/${id}`)
}
