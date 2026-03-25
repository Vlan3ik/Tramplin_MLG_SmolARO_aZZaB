import type { OpportunityType as MockOpportunityType } from '../data/mockData'

export type OpportunityType = MockOpportunityType

export type Opportunity = {
  id: number
  entityType?: 'vacancy' | 'opportunity'
  title: string
  type: OpportunityType
  status: number
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
  tagIds: number[]
  salaryFrom: number | null
  salaryTo: number | null
  statuses: number[]
  verifiedOnly: boolean
}

export const opportunityStatusLabel: Record<number, string> = {
  1: 'Запланировано',
  2: 'На модерации',
  3: 'Активно',
  4: 'Закрыто',
  5: 'Отменено',
  6: 'Отклонено',
  7: 'В архиве',
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
