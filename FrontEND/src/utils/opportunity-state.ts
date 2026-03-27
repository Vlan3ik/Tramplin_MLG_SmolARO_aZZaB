import { getSeekerPrivacySettingsSnapshot } from './seeker-privacy-settings'
import { readOpportunitySocialState, type OpportunitySocialStateSource } from './opportunity-social-state'

export type OpportunityStateBadgeTone = 'favorite' | 'friends' | 'responses'

export type OpportunityStateBadge = {
  id: 'favorite' | 'friends-favorite' | 'friends-applied'
  label: string
  tone: OpportunityStateBadgeTone
}

export function getOpportunityStateBadges(opportunity: OpportunitySocialStateSource, isFavoriteOverride?: boolean): OpportunityStateBadge[] {
  const socialState = readOpportunitySocialState(opportunity)
  const isFavorite = typeof isFavoriteOverride === 'boolean' ? isFavoriteOverride : socialState.isFavoriteByMe
  const badges: OpportunityStateBadge[] = []
  const privacySettings = getSeekerPrivacySettingsSnapshot()

  if (isFavorite) {
    badges.push({ id: 'favorite', label: '\u0412 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u043c', tone: 'favorite' })
  }

  if (socialState.friendFavoritesCount > 0) {
    badges.push({ id: 'friends-favorite', label: '\u0423 \u0434\u0440\u0443\u0437\u0435\u0439 \u0432 \u0438\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u043c', tone: 'friends' })
  }

  if (socialState.friendsAppliedCount > 0) {
    badges.push({
      id: 'friends-applied',
      label: `\u041e\u0442\u043a\u043b\u0438\u043a\u043d\u0443\u043b\u0438\u0441\u044c ${socialState.friendsAppliedCount} \u0434\u0440\u0443\u0437\u0435\u0439`,
      tone: 'responses',
    })
  }

  if (!privacySettings.showSocialProofs) {
    return badges.filter((badge) => badge.id !== 'friends-favorite' && badge.id !== 'friends-applied')
  }

  return badges
}
