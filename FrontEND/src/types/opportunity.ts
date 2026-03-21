import type { OpportunityType as MockOpportunityType } from '../data/mockData'

export type OpportunityType = MockOpportunityType

export type Opportunity = {
  id: number
  entityType?: 'vacancy' | 'opportunity'
  title: string
  type: OpportunityType
  compensation: string
  company: string
  location: string
  workFormat: string
  date: string
  description: string
  tags: string[]
  verified: boolean
  favoriteCompany?: boolean
  latitude?: number | null
  longitude?: number | null
}

export type OpportunityDetail = Opportunity & {
  shortDescription: string
  fullDescription: string
  publishAt: string | null
  applicationDeadline: string | null
  isParticipating?: boolean
  companyId: number | null
  companyWebsiteUrl: string | null
  companyPublicEmail: string | null
  address: string
}

export type OpportunityFilters = {
  types: OpportunityType[]
  formats: string[]
  verifiedOnly: boolean
}

export const typeLabel: Record<OpportunityType, string> = {
  vacancy: 'Вакансия',
  internship: 'Стажировка',
  mentorship: 'Менторство',
  event: 'Мероприятие',
}

export const formatLabel: Record<string, string> = {
  onsite: 'Офис',
  hybrid: 'Гибрид',
  remote: 'Удаленно',
}
