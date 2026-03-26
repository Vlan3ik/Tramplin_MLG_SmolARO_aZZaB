import type { Opportunity, OpportunityType } from '../types/opportunity'

export type OpportunityEntityType = 'vacancy' | 'opportunity'

type OpportunityTypeSource = {
  entityType?: OpportunityEntityType | null
  type?: OpportunityType
}

type OpportunityRouteParams = OpportunityTypeSource & {
  id: number
}

export function resolveEntityType(params: OpportunityTypeSource): OpportunityEntityType {
  if (params.entityType === 'vacancy' || params.entityType === 'opportunity') {
    return params.entityType
  }

  return params.type === 'vacancy' || params.type === 'internship' ? 'vacancy' : 'opportunity'
}

export function resolveEntityTypeFromOpportunity(opportunity: Pick<Opportunity, 'entityType' | 'type'>): OpportunityEntityType {
  return resolveEntityType({ entityType: opportunity.entityType, type: opportunity.type })
}

export function buildOpportunityDetailsPath(params: OpportunityRouteParams): string {
  const entityType = resolveEntityType(params)
  return `/opportunity/${params.id}?entityType=${entityType}`
}