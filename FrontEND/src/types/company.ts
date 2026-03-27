import type { OpportunityType } from './opportunity'

export type Company = {
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

export type CompanyMediaType = 'photo' | 'video'

export type CompanyMedia = {
  id: number
  type: CompanyMediaType
  url: string
  mimeType: string | null
  sortOrder: number
}

export type CompanyLink = {
  kind: string | null
  url: string | null
  label: string | null
}

export type CompanyOpportunity = {
  id: number
  entityType: 'vacancy' | 'opportunity'
  title: string | null
  type: OpportunityType | null
  typeLabel: string
  format: string | null
  formatLabel: string
  publishAt: string
}

export type CompanyDetail = {
  id: number
  legalName: string | null
  brandName: string | null
  displayName: string
  industry: string | null
  description: string | null
  verified: boolean
  cityName: string | null
  logoUrl: string | null
  websiteUrl: string | null
  publicEmail: string | null
  publicPhone: string | null
  media: CompanyMedia[]
  links: CompanyLink[]
  activeOpportunities: CompanyOpportunity[]
}

