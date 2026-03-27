import clsx from 'clsx'
import type { Opportunity } from '../../types/opportunity'
import { getOpportunityStateBadges } from '../../utils/opportunity-state'

type OpportunityStateBadgesProps = {
  opportunity: Opportunity
  isFavorite?: boolean
  compact?: boolean
  className?: string
}

export function OpportunityStateBadges({ opportunity, isFavorite, compact = false, className }: OpportunityStateBadgesProps) {
  const badges = getOpportunityStateBadges(opportunity, isFavorite)
  if (!badges.length) {
    return null
  }

  return (
    <div className={clsx('opportunity-state-badges', compact && 'opportunity-state-badges--compact', className)}>
      {badges.map((badge) => (
        <span key={badge.id} className={clsx('opportunity-state-badge', `opportunity-state-badge--${badge.tone}`)}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}
