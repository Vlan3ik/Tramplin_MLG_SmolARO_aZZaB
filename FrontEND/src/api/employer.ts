import { getJson, patchJson, postJson } from './client'
import type { OpportunityType } from '../types/opportunity'

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
  status: string
  membershipRole: string
  chatSettings: EmployerCompanyChatSettingsApi | null
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

type OpportunityListItemApi = {
  id: number
  title: string
  kind?: string | number
  type?: string | number
  format: string | number
  companyName: string
  locationName: string
  salaryFrom: number | null
  salaryTo: number | null
  currencyCode: string | null
  publishAt: string
  verifiedCompany: boolean
  tags: string[]
}

type PagedResponse<TItem> = {
  items: TItem[]
  totalCount?: number
  total?: number
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
  title: string
  type: OpportunityType
  format: string
  locationName: string
  salaryLabel: string
  publishAt: string
  tags: string[]
}

const typeMapByNumber: Record<number, OpportunityType> = {
  1: 'internship',
  2: 'vacancy',
  3: 'mentorship',
  4: 'event',
}

function toNullableString(value: string) {
  const normalized = value.trim()
  return normalized.length ? normalized : null
}

function parseOpportunityType(value: string | number): OpportunityType {
  if (typeof value === 'number') {
    if (value === 1) return 'internship'
    if (value === 2) return 'vacancy'
    return typeMapByNumber[value] ?? 'vacancy'
  }

  const normalized = value.toLowerCase()
  if (normalized.includes('intern')) return 'internship'
  if (normalized.includes('ment')) return 'mentorship'
  if (normalized.includes('event')) return 'event'
  return 'vacancy'
}

function parseOpportunityFormat(value: string | number) {
  if (typeof value === 'number') {
    if (value === 1) return 'Офис'
    if (value === 3) return 'Удаленно'
    return 'Гибрид'
  }

  const normalized = value.toLowerCase()
  if (normalized.includes('remote')) return 'Удаленно'
  if (normalized.includes('onsite')) return 'Офис'
  return 'Гибрид'
}

function formatSalary(from: number | null, to: number | null, currencyCode: string | null) {
  if (from === null && to === null) {
    return 'По договоренности'
  }

  const currency = currencyCode ?? 'RUB'
  const formatter = new Intl.NumberFormat('ru-RU')

  if (from !== null && to !== null) {
    return `${formatter.format(from)} - ${formatter.format(to)} ${currency}`
  }

  if (from !== null) {
    return `от ${formatter.format(from)} ${currency}`
  }

  return `до ${formatter.format(to ?? 0)} ${currency}`
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
    status: response.status ?? 'draft',
    membershipRole: response.membershipRole ?? 'staff',
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

export async function fetchEmployerCompanyOpportunities(companyId: number, signal?: AbortSignal) {
  const response = await getJson<PagedResponse<OpportunityListItemApi>>(
    `/vacancies?Page=1&PageSize=100&CompanyId=${companyId}`,
    { signal, withAuth: false },
  )

  return (response.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    type: parseOpportunityType((item.kind ?? item.type ?? 2) as string | number),
    format: parseOpportunityFormat(item.format),
    locationName: item.locationName || 'Локация не указана',
    salaryLabel: formatSalary(item.salaryFrom, item.salaryTo, item.currencyCode),
    publishAt: item.publishAt,
    tags: item.tags ?? [],
  }))
}
