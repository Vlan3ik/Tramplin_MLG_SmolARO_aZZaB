import clsx from 'clsx'
import { useOpportunitySocialState } from '../../hooks/useOpportunitySocialState'
import { useSeekerPrivacySettings } from '../../hooks/useSeekerPrivacySettings'
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
  const privacySettings = useSeekerPrivacySettings()
  const badges = getOpportunityStateBadges(
    {
      ...opportunity,
      isFavoriteByMe: socialState.isFavoriteByMe,
      friendFavoritesCount: socialState.friendFavoritesCount,
      friendsAppliedCount: socialState.friendsAppliedCount,
    },
    isFavorite,
  ).filter((badge) => {
    if (privacySettings.showSocialProofs) {
      return true
    }

    return badge.id !== 'friends-favorite' && badge.id !== 'friends-applied'
  })
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
