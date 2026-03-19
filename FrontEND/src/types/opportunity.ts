import type { OpportunityType as MockOpportunityType } from '../data/mockData'

export type OpportunityType = MockOpportunityType

export type Opportunity = {
  id: number
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
