import { deleteJson, getJson, patchJson, postForm, postJson, putJson } from './client'

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
  fio: string
  avatarUrl: string | null
  status: number | string
  roles: string[] | null
  createdAt: string
}

type UploadMediaApi = {
  url?: string | null
  avatarUrl?: string | null
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

type AdminResumeApi = {
  userId: number
  username: string
  fio: string
  headline: string | null
  desiredPosition: string | null
  updatedAt: string
  isArchived: boolean
  userStatus: number | string
}

type AdminUserUpsertApiRequest = {
  email: string
  username: string
  fio: string
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
  fio: string
  avatarUrl: string | null
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

export type AdminVerificationDocument = {
  id: number
  documentType: number
  fileName: string
  contentType: string
  sizeBytes: number
  status: number
  moderatorComment: string
  uploadedByUserId: number
  reviewedByUserId: number | null
  reviewedAt: string | null
  createdAt: string
}

export type AdminCompanyVerificationDetail = {
  companyId: number
  legalName: string
  brandName: string
  companyStatus: number
  employerType: number
  reviewStatus: number
  ogrnOrOgrnip: string
  inn: string
  kpp: string
  legalAddress: string
  actualAddress: string
  representativeFullName: string
  representativePosition: string
  mainIndustryId: number
  mainIndustryName: string
  taxOffice: string
  workEmail: string
  workPhone: string
  siteOrPublicLinks: string
  submittedAt: string | null
  verifiedAt: string | null
  verifiedByUserId: number | null
  rejectReason: string
  missingDocs: string[]
  documents: AdminVerificationDocument[]
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

export type AdminResume = {
  userId: number
  username: string
  fio: string
  headline: string
  desiredPosition: string
  updatedAt: string
  isArchived: boolean
  userStatus: number
}

export type AdminUserUpsertRequest = {
  email: string
  username: string
  fio: string
  status: number
  roles: number[]
}

export type AdminUserResetPasswordResponse = {
  tempPassword: string
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
    fio: item.fio ?? '',
    avatarUrl: item.avatarUrl ?? null,
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

function mapResume(item: AdminResumeApi): AdminResume {
  return {
    userId: item.userId,
    username: item.username ?? '',
    fio: item.fio ?? '',
    headline: item.headline ?? '',
    desiredPosition: item.desiredPosition ?? '',
    updatedAt: item.updatedAt,
    isArchived: item.isArchived ?? false,
    userStatus: parseEnum(item.userStatus),
  }
}

function mapUserUpsertRequest(payload: AdminUserUpsertRequest): AdminUserUpsertApiRequest {
  return {
    email: payload.email.trim(),
    username: payload.username.trim(),
    fio: payload.fio.trim(),
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

export async function fetchAdminUserById(id: number, signal?: AbortSignal) {
  const response = await getJson<AdminUserApi>(`/admin/users/${id}`, { signal })
  return mapUser(response)
}

export function createAdminUser(payload: AdminUserUpsertRequest) {
  return postJson<AdminUserApi, AdminUserUpsertApiRequest>('/admin/users', mapUserUpsertRequest(payload)).then(mapUser)
}

export function updateAdminUser(id: number, payload: AdminUserUpsertRequest) {
  return putJson<AdminUserApi, AdminUserUpsertApiRequest>(`/admin/users/${id}`, mapUserUpsertRequest(payload)).then(mapUser)
}

export function resetAdminUserPassword(id: number) {
  return postJson<AdminUserResetPasswordResponse, Record<string, never>>(`/admin/users/${id}/reset-password`, {})
}

export async function uploadAdminUserAvatar(id: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await postForm<UploadMediaApi>(`/admin/users/${id}/avatar`, formData)
  return (response.url ?? response.avatarUrl ?? '').trim()
}

export function deleteAdminUser(id: number) {
  return deleteJson<unknown>(`/admin/users/${id}`)
}

export function updateAdminUserStatus(id: number, status: number) {
  return patchJson<unknown, { status: number }>(`/admin/users/${id}/status`, { status })
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
  return postJson<unknown, Record<string, never>>(`/admin/companies/${id}/verification/approve`, {})
}

export function rejectAdminCompany(id: number, rejectReason = 'Rejected by moderator', missingDocuments: number[] = []) {
  return postJson<unknown, { rejectReason: string; missingDocuments: number[] }>(`/admin/companies/${id}/verification/reject`, {
    rejectReason,
    missingDocuments,
  })
}

export function fetchAdminCompanyVerification(id: number) {
  return getJson<AdminCompanyVerificationDetail>(`/admin/companies/${id}/verification`)
}

export function acceptAdminCompanyVerificationDocument(companyId: number, docId: number, moderatorComment = '') {
  return postJson<unknown, { moderatorComment: string }>(`/admin/companies/${companyId}/verification/documents/${docId}/accept`, {
    moderatorComment,
  })
}

export function rejectAdminCompanyVerificationDocument(companyId: number, docId: number, moderatorComment = '') {
  return postJson<unknown, { moderatorComment: string }>(`/admin/companies/${companyId}/verification/documents/${docId}/reject`, {
    moderatorComment,
  })
}

export function updateAdminCompanyStatus(id: number, status: number) {
  return patchJson<unknown, { status: number }>(`/admin/companies/${id}/status`, { status })
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

export function updateAdminVacancyStatus(id: number, status: number) {
  return patchJson<unknown, { status: number }>(`/admin/vacancies/${id}/status`, { status })
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

export function updateAdminOpportunityStatus(id: number, status: number) {
  return patchJson<unknown, { status: number }>(`/admin/opportunities/${id}/status`, { status })
}

export function deleteAdminOpportunity(id: number) {
  return deleteJson<unknown>(`/admin/opportunities/${id}`)
}

export async function fetchAdminResumes(options: FetchListOptions = {}) {
  const response = await getJson<PagedResponse<AdminResumeApi>>(`/admin/resumes?${buildListQuery(options)}`, { signal: options.signal })
  return {
    items: (response.items ?? []).map(mapResume),
    totalCount: response.totalCount ?? 0,
  }
}

export function updateAdminResumeArchive(userId: number, isArchived: boolean) {
  return patchJson<unknown, { isArchived: boolean }>(`/admin/resumes/${userId}/archive`, { isArchived })
}

export function banAdminResumeAuthor(userId: number) {
  return postJson<unknown, Record<string, never>>(`/admin/resumes/${userId}/ban-author`, {})
}

export function deleteAdminResume(userId: number) {
  return deleteJson<unknown>(`/admin/resumes/${userId}`)
}
