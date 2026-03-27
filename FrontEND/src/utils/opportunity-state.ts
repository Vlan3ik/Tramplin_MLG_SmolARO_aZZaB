import type { Opportunity } from '../types/opportunity'

export type OpportunityStateBadgeTone = 'favorite' | 'friends' | 'responses'

export type OpportunityStateBadge = {
  id: 'favorite' | 'friends-favorite' | 'friends-applied'
  label: string
  tone: OpportunityStateBadgeTone
}

export function getOpportunityStateBadges(opportunity: Opportunity, isFavoriteOverride?: boolean): OpportunityStateBadge[] {
  const isFavorite = typeof isFavoriteOverride === 'boolean' ? isFavoriteOverride : opportunity.isFavoriteByMe
  const badges: OpportunityStateBadge[] = []

  if (isFavorite) {
    badges.push({ id: 'favorite', label: 'В избранном', tone: 'favorite' })
  }

  if (opportunity.friendFavoritesCount > 0) {
    badges.push({ id: 'friends-favorite', label: 'У друзей в избранном', tone: 'friends' })
  }

  if (opportunity.friendsAppliedCount > 0) {
    badges.push({
      id: 'friends-applied',
      label: `Откликнулись ${opportunity.friendsAppliedCount} друзей`,
      tone: 'responses',
    })
  }

  return badges
}
