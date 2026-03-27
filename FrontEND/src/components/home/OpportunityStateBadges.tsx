import clsx from 'clsx'
import { useOpportunitySocialState } from '../../hooks/useOpportunitySocialState'
import type { Opportunity } from '../../types/opportunity'
import { getOpportunityStateBadges } from '../../utils/opportunity-state'

type OpportunityStateBadgesProps = {
  opportunity: Opportunity
  isFavorite?: boolean
  compact?: boolean
  className?: string
}

export function OpportunityStateBadges({ opportunity, isFavorite, compact = false, className }: OpportunityStateBadgesProps) {
  const socialState = useOpportunitySocialState(opportunity)
  const badges = getOpportunityStateBadges(
    {
      ...opportunity,
      isFavoriteByMe: socialState.isFavoriteByMe,
      friendFavoritesCount: socialState.friendFavoritesCount,
      friendsAppliedCount: socialState.friendsAppliedCount,
    },
    isFavorite,
  )
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
