import { deleteJson, getJson, patchJson, postJson } from './client'
import type { OpportunityType } from '../types/opportunity'
import type { ResumeEducation, ResumeExperience, ResumeLink, ResumeProject, ResumeSkill } from '../types/resume'

type PagedResponse<TItem> = {
  items?: TItem[] | null
  totalCount?: number
  page?: number
  pageSize?: number
}

type EmployerCompanyChatSettingsApi = {
  autoGreetingEnabled: boolean
  autoGreetingText: string | null
  outsideHoursEnabled: boolean
  outsideHoursText: string | null
  workingHoursTimezone: string | null
  workingHoursFrom: string | null
  workingHoursTo: string | null
}

type EmployerCompanyApi = {
  id: number
  legalName: string | null
  brandName: string | null
  legalType: number
  taxId: string | null
  registrationNumber: string | null
  industry: string | null
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  publicEmail: string | null
  publicPhone: string | null
  baseCityId: number
  status: number | string
  membershipRole: number | string
  chatSettings: EmployerCompanyChatSettingsApi | null
}

type EmployerVacancyListItemApi = {
  id: number
  title: string | null
  kind: number
  format: number
  status: number
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  salaryTaxMode: number
  publishAt: string
  applicationDeadline: string | null
  applicationsTotal: number
  applicationsLast24Hours: number
  tags: string[] | null
}

type EmployerOpportunityListItemApi = {
  id: number
  title: string | null
  kind: number
  format: number
  status: number
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
  participantsCanWrite: boolean
  publishAt: string
  eventDate: string | null
  participantsCount: number
  participantsLast24Hours: number
  tags: string[] | null
}

type EmployerApplicationListItemApi = {
  id: number
  vacancyId: number
  vacancyTitle: string | null
  candidateUserId: number
  candidateName: string | null
  candidateAvatarUrl: string | null
  status: number
  createdAt: string
  updatedAt: string
  chatId: number | null
}

type EmployerApplicationDetailApi = {
  id: number
  companyId: number
  vacancyId: number
  vacancyTitle: string | null
  candidateUserId: number
  candidateName: string | null
  candidateAvatarUrl: string | null
  candidateHeadline: string | null
  candidateDesiredPosition: string | null
  candidateSalaryFrom: number | null
  candidateSalaryTo: number | null
  candidateCurrencyCode: string | null
  status: number
  initiatorRole: number
  createdAt: string
  updatedAt: string
  chatId: number | null
  candidateResume: EmployerCandidateResumeApi | null
}

type EmployerCandidateResumeApi = {
  userId: number
  username: string
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string | null
  gender: number
  phone: string | null
  about: string | null
  avatarUrl: string | null
  headline: string | null
  desiredPosition: string | null
  summary: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  openToWork: boolean
  skills: Array<{
    tagId: number
    tagName: string
    level: number | null
    yearsExperience: number | null
  }> | null
  experiences: Array<{
    id: number
    companyId: number | null
    companyName: string
    position: string
    description: string | null
    startDate: string | null
    endDate: string | null
    isCurrent: boolean
  }> | null
  projects: Array<{
    id: number
    title: string
    role: string | null
    description: string | null
    startDate: string | null
    endDate: string | null
    repoUrl: string | null
    demoUrl: string | null
  }> | null
  education: Array<{
    id: number
    university: string
    faculty: string | null
    specialty: string | null
    course: number | null
    graduationYear: number | null
  }> | null
  links: Array<{
    id: number
    kind: string
    url: string
    label: string | null
  }> | null
}

type CreateEmployerCompanyApiRequest = {
  legalName: string
  brandName: string | null
  logoUrl: string | null
}

type UpdateEmployerCompanyVerificationApiRequest = {
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
}

type UpdateEmployerCompanyChatSettingsApiRequest = {
  autoGreetingEnabled: boolean
  autoGreetingText: string | null
  outsideHoursEnabled: boolean
  outsideHoursText: string | null
  workingHoursTimezone: string
  workingHoursFrom: string | null
  workingHoursTo: string | null
}

type EmployerVacancyUpsertRequest = {
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
  tagIds: number[]
}

type EmployerOpportunityUpsertRequest = {
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
  tagIds: number[]
}

type EmployerLocationApi = {
  cityId: number | null
  cityName: string | null
  latitude: number | null
  longitude: number | null
  streetName: string | null
  houseNumber: string | null
}

type EmployerVacancyDetailApi = {
  id: number
  title: string | null
  shortDescription: string | null
  fullDescription: string | null
  kind: number
  format: number
  status: number
  publishAt: string
  applicationDeadline: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  salaryTaxMode: number
  location: EmployerLocationApi | null
  tags: string[] | null
}

type EmployerOpportunityDetailApi = {
  id: number
  title: string | null
  shortDescription: string | null
  fullDescription: string | null
  kind: number
  format: number
  status: number
  publishAt: string
  eventDate: string | null
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
  participantsCanWrite: boolean
  location: EmployerLocationApi | null
  tags: string[] | null
}

export type EmployerCompany = {
  id: number
  legalName: string
  brandName: string
  legalType: number
  taxId: string
  registrationNumber: string
  industry: string
  description: string
  logoUrl: string | null
  websiteUrl: string
  publicEmail: string
  publicPhone: string
  baseCityId: number
  status: string
  membershipRole: string
  chatSettings: {
    autoGreetingEnabled: boolean
    autoGreetingText: string
    outsideHoursEnabled: boolean
    outsideHoursText: string
    workingHoursTimezone: string
    workingHoursFrom: string
    workingHoursTo: string
  }
}

export type CreateEmployerCompanyRequest = {
  legalName: string
  brandName: string
  logoUrl: string
}

export type UpdateEmployerCompanyVerificationRequest = {
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
}

export type UpdateEmployerCompanyChatSettingsRequest = {
  autoGreetingEnabled: boolean
  autoGreetingText: string
  outsideHoursEnabled: boolean
  outsideHoursText: string
  workingHoursTimezone: string
  workingHoursFrom: string
  workingHoursTo: string
}

export type EmployerOpportunity = {
  id: number
  source: 'vacancy' | 'opportunity'
  title: string
  type: OpportunityType
  format: string
  locationName: string
  compensationLabel: string
  status: number
  publishAt: string
  tags: string[]
}

export type EmployerApplication = {
  id: number
  vacancyId: number
  vacancyTitle: string
  candidateUserId: number
  candidateName: string
  status: number
  createdAt: string
  updatedAt: string
  chatId: number | null
}

export type EmployerApplicationDetail = {
  id: number
  companyId: number
  vacancyId: number
  vacancyTitle: string
  candidateUserId: number
  candidateName: string
  candidateAvatarUrl: string | null
  candidateHeadline: string
  candidateDesiredPosition: string
  candidateSalaryFrom: number | null
  candidateSalaryTo: number | null
  candidateCurrencyCode: string | null
  status: number
  initiatorRole: number
  createdAt: string
  updatedAt: string
  chatId: number | null
  candidateResume: EmployerCandidateResume | null
}

export type EmployerCandidateResume = {
  userId: number
  username: string
  firstName: string
  lastName: string
  middleName: string
  birthDate: string
  gender: number
  phone: string
  about: string
  avatarUrl: string | null
  headline: string
  desiredPosition: string
  summary: string
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string
  openToWork: boolean
  skills: ResumeSkill[]
  experiences: ResumeExperience[]
  projects: ResumeProject[]
  education: ResumeEducation[]
  links: ResumeLink[]
}

export type CreateEmployerVacancyRequest = {
  title: string
  shortDescription?: string
  fullDescription?: string
  kind?: number
  format?: number
  status?: number
  cityId?: number | null
  locationId?: number | null
  salaryFrom?: number | null
  salaryTo?: number | null
  currencyCode?: string | null
  salaryTaxMode?: number
  publishAt?: string
  applicationDeadline?: string | null
  tagIds?: number[]
}

export type CreateEmployerOpportunityRequest = {
  title: string
  shortDescription?: string
  fullDescription?: string
  kind?: number
  format?: number
  status?: number
  cityId?: number | null
  locationId?: number | null
  priceType?: number
  priceAmount?: number | null
  priceCurrencyCode?: string | null
  participantsCanWrite?: boolean
  publishAt?: string
  eventDate?: string | null
  tagIds?: number[]
}

export type EmployerVacancyDetail = {
  id: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  publishAt: string
  applicationDeadline: string | null
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  salaryTaxMode: number
  locationStreetName: string
  locationHouseNumber: string
  tags: string[]
}

export type EmployerOpportunityDetail = {
  id: number
  title: string
  shortDescription: string
  fullDescription: string
  kind: number
  format: number
  status: number
  cityId: number | null
  publishAt: string
  eventDate: string | null
  priceType: number
  priceAmount: number | null
  priceCurrencyCode: string | null
  participantsCanWrite: boolean
  locationStreetName: string
  locationHouseNumber: string
  tags: string[]
}

const companyStatusMap: Record<number, string> = {
  1: 'draft',
  2: 'pendingverification',
  3: 'verified',
  4: 'rejected',
  5: 'blocked',
}

const memberRoleMap: Record<number, string> = {
  1: 'owner',
  2: 'admin',
  3: 'staff',
}

const companyStatusStringMap: Record<string, string> = {
  draft: 'draft',
  pendingverification: 'pendingverification',
  pending_verification: 'pendingverification',
  verified: 'verified',
  rejected: 'rejected',
  blocked: 'blocked',
}

const memberRoleStringMap: Record<string, string> = {
  owner: 'owner',
  admin: 'admin',
  staff: 'staff',
}

function toNullableString(value: string) {
  const normalized = value.trim()
  return normalized.length ? normalized : null
}

function parseCompanyStatus(value: number | string) {
  if (typeof value === 'number') {
    return companyStatusMap[value] ?? 'draft'
  }

  return companyStatusStringMap[value.trim().toLowerCase()] ?? 'draft'
}

function parseMemberRole(value: number | string) {
  if (typeof value === 'number') {
    return memberRoleMap[value] ?? 'staff'
  }

  return memberRoleStringMap[value.trim().toLowerCase()] ?? 'staff'
}

function formatCurrencyRange(min: number | null | undefined, max: number | null | undefined, currencyCode: string | null | undefined) {
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

function formatOpportunityPrice(priceType: number, amount: number | null | undefined, currencyCode: string | null | undefined) {
  if (priceType === 1) {
    return 'Бесплатно'
  }

  if (amount == null) {
    return 'Условия уточняются'
  }

  const formatter = new Intl.NumberFormat('ru-RU')
  const currency = currencyCode ?? 'RUB'
  return `${formatter.format(amount)} ${currency}`
}

function parseFormatLabel(value: number) {
  if (value === 1) return 'Офис'
  if (value === 3) return 'Удаленно'
  return 'Гибрид'
}

function parseVacancyType(kind: number): OpportunityType {
  if (kind === 1) return 'internship'
  return 'vacancy'
}

function parseOpportunityType(kind: number): OpportunityType {
  if (kind === 3) return 'mentorship'
  return 'event'
}

function mapEmployerCompany(response: EmployerCompanyApi): EmployerCompany {
  return {
    id: response.id,
    legalName: response.legalName ?? '',
    brandName: response.brandName ?? '',
    legalType: response.legalType ?? 1,
    taxId: response.taxId ?? '',
    registrationNumber: response.registrationNumber ?? '',
    industry: response.industry ?? '',
    description: response.description ?? '',
    logoUrl: response.logoUrl,
    websiteUrl: response.websiteUrl ?? '',
    publicEmail: response.publicEmail ?? '',
    publicPhone: response.publicPhone ?? '',
    baseCityId: response.baseCityId ?? 0,
    status: parseCompanyStatus(response.status),
    membershipRole: parseMemberRole(response.membershipRole),
    chatSettings: {
      autoGreetingEnabled: response.chatSettings?.autoGreetingEnabled ?? false,
      autoGreetingText: response.chatSettings?.autoGreetingText ?? '',
      outsideHoursEnabled: response.chatSettings?.outsideHoursEnabled ?? false,
      outsideHoursText: response.chatSettings?.outsideHoursText ?? '',
      workingHoursTimezone: response.chatSettings?.workingHoursTimezone ?? 'Europe/Moscow',
      workingHoursFrom: response.chatSettings?.workingHoursFrom ?? '',
      workingHoursTo: response.chatSettings?.workingHoursTo ?? '',
    },
  }
}

function toIsoDateOrNow(value?: string) {
  if (value && value.trim()) {
    return value
  }

  return new Date().toISOString()
}

function mapVacancyForCreate(payload: CreateEmployerVacancyRequest): EmployerVacancyUpsertRequest {
  return {
    title: payload.title.trim(),
    shortDescription: payload.shortDescription?.trim() ?? '',
    fullDescription: payload.fullDescription?.trim() ?? '',
    kind: payload.kind ?? 2,
    format: payload.format ?? 2,
    status: payload.status ?? 1,
    cityId: payload.cityId ?? null,
    locationId: payload.locationId ?? null,
    salaryFrom: payload.salaryFrom ?? null,
    salaryTo: payload.salaryTo ?? null,
    currencyCode: payload.currencyCode?.trim() || null,
    salaryTaxMode: payload.salaryTaxMode ?? 3,
    publishAt: toIsoDateOrNow(payload.publishAt),
    applicationDeadline: payload.applicationDeadline?.trim() || null,
    tagIds: payload.tagIds ?? [],
  }
}

function mapOpportunityForCreate(payload: CreateEmployerOpportunityRequest): EmployerOpportunityUpsertRequest {
  return {
    title: payload.title.trim(),
    shortDescription: payload.shortDescription?.trim() ?? '',
    fullDescription: payload.fullDescription?.trim() ?? '',
    kind: payload.kind ?? 4,
    format: payload.format ?? 2,
    status: payload.status ?? 1,
    cityId: payload.cityId ?? null,
    locationId: payload.locationId ?? null,
    priceType: payload.priceType ?? 1,
    priceAmount: payload.priceAmount ?? null,
    priceCurrencyCode: payload.priceCurrencyCode?.trim() || null,
    participantsCanWrite: payload.participantsCanWrite ?? true,
    publishAt: toIsoDateOrNow(payload.publishAt),
    eventDate: payload.eventDate?.trim() || null,
    tagIds: payload.tagIds ?? [],
  }
}

function mapVacancyDetail(response: EmployerVacancyDetailApi): EmployerVacancyDetail {
  return {
    id: response.id,
    title: response.title ?? '',
    shortDescription: response.shortDescription ?? '',
    fullDescription: response.fullDescription ?? '',
    kind: response.kind ?? 2,
    format: response.format ?? 2,
    status: response.status ?? 1,
    cityId: response.location?.cityId ?? null,
    publishAt: response.publishAt,
    applicationDeadline: response.applicationDeadline ?? null,
    salaryFrom: response.salaryFrom ?? null,
    salaryTo: response.salaryTo ?? null,
    currencyCode: response.currencyCode ?? null,
    salaryTaxMode: response.salaryTaxMode ?? 3,
    locationStreetName: response.location?.streetName ?? '',
    locationHouseNumber: response.location?.houseNumber ?? '',
    tags: response.tags ?? [],
  }
}

function mapOpportunityDetail(response: EmployerOpportunityDetailApi): EmployerOpportunityDetail {
  return {
    id: response.id,
    title: response.title ?? '',
    shortDescription: response.shortDescription ?? '',
    fullDescription: response.fullDescription ?? '',
    kind: response.kind ?? 4,
    format: response.format ?? 2,
    status: response.status ?? 1,
    cityId: response.location?.cityId ?? null,
    publishAt: response.publishAt,
    eventDate: response.eventDate ?? null,
    priceType: response.priceType ?? 1,
    priceAmount: response.priceAmount ?? null,
    priceCurrencyCode: response.priceCurrencyCode ?? null,
    participantsCanWrite: response.participantsCanWrite ?? true,
    locationStreetName: response.location?.streetName ?? '',
    locationHouseNumber: response.location?.houseNumber ?? '',
    tags: response.tags ?? [],
  }
}

export async function fetchEmployerCompany(signal?: AbortSignal) {
  const response = await getJson<EmployerCompanyApi>('/employer/company', { signal })
  return mapEmployerCompany(response)
}

export function createEmployerCompany(payload: CreateEmployerCompanyRequest) {
  const request: CreateEmployerCompanyApiRequest = {
    legalName: payload.legalName.trim(),
    brandName: toNullableString(payload.brandName),
    logoUrl: toNullableString(payload.logoUrl),
  }

  return postJson<{ companyId?: number }, CreateEmployerCompanyApiRequest>('/employer/company', request)
}

export function updateEmployerCompanyVerification(payload: UpdateEmployerCompanyVerificationRequest) {
  const request: UpdateEmployerCompanyVerificationApiRequest = {
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
  }

  return patchJson<unknown, UpdateEmployerCompanyVerificationApiRequest>('/employer/company/verification', request)
}

export function updateEmployerCompanyChatSettings(payload: UpdateEmployerCompanyChatSettingsRequest) {
  const request: UpdateEmployerCompanyChatSettingsApiRequest = {
    autoGreetingEnabled: payload.autoGreetingEnabled,
    autoGreetingText: toNullableString(payload.autoGreetingText),
    outsideHoursEnabled: payload.outsideHoursEnabled,
    outsideHoursText: toNullableString(payload.outsideHoursText),
    workingHoursTimezone: payload.workingHoursTimezone.trim() || 'Europe/Moscow',
    workingHoursFrom: toNullableString(payload.workingHoursFrom),
    workingHoursTo: toNullableString(payload.workingHoursTo),
  }

  return patchJson<unknown, UpdateEmployerCompanyChatSettingsApiRequest>('/employer/company/chat-settings', request)
}

export function submitEmployerCompanyVerification() {
  return postJson<unknown, Record<string, never>>('/employer/company/submit-verification', {})
}

export async function fetchEmployerVacancies(signal?: AbortSignal) {
  const response = await getJson<PagedResponse<EmployerVacancyListItemApi>>('/employer/vacancies?Page=1&PageSize=100', { signal })

  return (response.items ?? []).map((item): EmployerOpportunity => ({
    id: item.id,
    source: 'vacancy',
    title: item.title ?? 'Без названия',
    type: parseVacancyType(item.kind),
    format: parseFormatLabel(item.format),
    locationName: 'Локация в карточке',
    compensationLabel: formatCurrencyRange(item.salaryFrom, item.salaryTo, item.currencyCode),
    status: item.status,
    publishAt: item.publishAt,
    tags: item.tags ?? [],
  }))
}

export async function fetchEmployerOpportunities(signal?: AbortSignal) {
  const response = await getJson<PagedResponse<EmployerOpportunityListItemApi>>('/employer/opportunities?Page=1&PageSize=100', { signal })

  return (response.items ?? []).map((item): EmployerOpportunity => ({
    id: item.id,
    source: 'opportunity',
    title: item.title ?? 'Без названия',
    type: parseOpportunityType(item.kind),
    format: parseFormatLabel(item.format),
    locationName: 'Локация в карточке',
    compensationLabel: formatOpportunityPrice(item.priceType, item.priceAmount, item.priceCurrencyCode),
    status: item.status,
    publishAt: item.publishAt,
    tags: item.tags ?? [],
  }))
}

export async function fetchEmployerCompanyOpportunities(signal?: AbortSignal) {
  const [vacancies, opportunities] = await Promise.all([fetchEmployerVacancies(signal), fetchEmployerOpportunities(signal)])
  return [...vacancies, ...opportunities].sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt))
}

export function createEmployerVacancy(payload: CreateEmployerVacancyRequest) {
  return postJson<unknown, EmployerVacancyUpsertRequest>('/employer/vacancies', mapVacancyForCreate(payload))
}

export function createEmployerOpportunity(payload: CreateEmployerOpportunityRequest) {
  return postJson<unknown, EmployerOpportunityUpsertRequest>('/employer/opportunities', mapOpportunityForCreate(payload))
}

export async function fetchEmployerVacancyDetail(id: number, signal?: AbortSignal) {
  const response = await getJson<EmployerVacancyDetailApi>(`/employer/vacancies/${id}`, { signal })
  return mapVacancyDetail(response)
}

export async function fetchEmployerOpportunityDetail(id: number, signal?: AbortSignal) {
  const response = await getJson<EmployerOpportunityDetailApi>(`/employer/opportunities/${id}`, { signal })
  return mapOpportunityDetail(response)
}

export function updateEmployerVacancy(id: number, payload: CreateEmployerVacancyRequest) {
  return patchJson<unknown, EmployerVacancyUpsertRequest>(`/employer/vacancies/${id}`, mapVacancyForCreate(payload))
}

export function updateEmployerOpportunity(id: number, payload: CreateEmployerOpportunityRequest) {
  return patchJson<unknown, EmployerOpportunityUpsertRequest>(`/employer/opportunities/${id}`, mapOpportunityForCreate(payload))
}

export function deleteEmployerVacancy(id: number) {
  return deleteJson<unknown>(`/employer/vacancies/${id}`)
}

export function deleteEmployerOpportunity(id: number) {
  return deleteJson<unknown>(`/employer/opportunities/${id}`)
}

export async function fetchEmployerApplications(signal?: AbortSignal) {
  const response = await getJson<PagedResponse<EmployerApplicationListItemApi>>('/employer/applications?Page=1&PageSize=100', { signal })

  return (response.items ?? []).map((item): EmployerApplication => ({
    id: item.id,
    vacancyId: item.vacancyId,
    vacancyTitle: item.vacancyTitle ?? 'Вакансия',
    candidateUserId: item.candidateUserId,
    candidateName: item.candidateName ?? `Пользователь #${item.candidateUserId}`,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    chatId: item.chatId ?? null,
  }))
}

export async function fetchEmployerApplicationDetail(applicationId: number, signal?: AbortSignal) {
  const response = await getJson<EmployerApplicationDetailApi>(`/employer/applications/${applicationId}`, { signal })

  const candidateResume = response.candidateResume
    ? {
        userId: response.candidateResume.userId,
        username: response.candidateResume.username,
        firstName: response.candidateResume.firstName,
        lastName: response.candidateResume.lastName,
        middleName: response.candidateResume.middleName ?? '',
        birthDate: response.candidateResume.birthDate ?? '',
        gender: response.candidateResume.gender ?? 0,
        phone: response.candidateResume.phone ?? '',
        about: response.candidateResume.about ?? '',
        avatarUrl: response.candidateResume.avatarUrl ?? null,
        headline: response.candidateResume.headline ?? '',
        desiredPosition: response.candidateResume.desiredPosition ?? '',
        summary: response.candidateResume.summary ?? '',
        salaryFrom: response.candidateResume.salaryFrom ?? null,
        salaryTo: response.candidateResume.salaryTo ?? null,
        currencyCode: response.candidateResume.currencyCode ?? 'RUB',
        openToWork: response.candidateResume.openToWork,
        skills: Array.isArray(response.candidateResume.skills)
          ? response.candidateResume.skills.map((skill) => ({
              tagId: skill.tagId,
              tagName: skill.tagName,
              level: skill.level ?? 0,
              yearsExperience: skill.yearsExperience ?? 0,
            }))
          : [],
        experiences: Array.isArray(response.candidateResume.experiences)
          ? response.candidateResume.experiences.map((experience) => ({
              id: experience.id,
              companyId: experience.companyId ?? null,
              companyName: experience.companyName,
              position: experience.position,
              description: experience.description ?? '',
              startDate: experience.startDate ?? '',
              endDate: experience.endDate ?? '',
              isCurrent: Boolean(experience.isCurrent),
            }))
          : [],
        projects: Array.isArray(response.candidateResume.projects)
          ? response.candidateResume.projects.map((project) => ({
              id: project.id,
              title: project.title,
              role: project.role ?? '',
              description: project.description ?? '',
              startDate: project.startDate ?? '',
              endDate: project.endDate ?? '',
              repoUrl: project.repoUrl ?? '',
              demoUrl: project.demoUrl ?? '',
            }))
          : [],
        education: Array.isArray(response.candidateResume.education)
          ? response.candidateResume.education.map((education) => ({
              id: education.id,
              university: education.university,
              faculty: education.faculty ?? '',
              specialty: education.specialty ?? '',
              course: education.course ?? 0,
              graduationYear: education.graduationYear ?? 0,
            }))
          : [],
        links: Array.isArray(response.candidateResume.links)
          ? response.candidateResume.links.map((link) => ({
              id: link.id,
              kind: link.kind,
              url: link.url,
              label: link.label ?? '',
            }))
          : [],
      }
    : null

  return {
    id: response.id,
    companyId: response.companyId,
    vacancyId: response.vacancyId,
    vacancyTitle: response.vacancyTitle ?? 'Вакансия',
    candidateUserId: response.candidateUserId,
    candidateName: response.candidateName ?? `Пользователь #${response.candidateUserId}`,
    candidateAvatarUrl: response.candidateAvatarUrl ?? null,
    candidateHeadline: response.candidateHeadline ?? '',
    candidateDesiredPosition: response.candidateDesiredPosition ?? '',
    candidateSalaryFrom: response.candidateSalaryFrom ?? null,
    candidateSalaryTo: response.candidateSalaryTo ?? null,
    candidateCurrencyCode: response.candidateCurrencyCode ?? null,
    status: response.status,
    initiatorRole: response.initiatorRole,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    chatId: response.chatId ?? null,
    candidateResume,
  } satisfies EmployerApplicationDetail
}

type UpdateEmployerApplicationStatusApiRequest = {
  status: number
}

export function updateEmployerApplicationStatus(applicationId: number, status: number) {
  const payload: UpdateEmployerApplicationStatusApiRequest = {
    status,
  }

  return patchJson<unknown, UpdateEmployerApplicationStatusApiRequest>(`/employer/applications/${applicationId}/status`, payload)
}
