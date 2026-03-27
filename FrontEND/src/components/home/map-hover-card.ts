import type { Opportunity } from '../../types/opportunity'
import { getOpportunityStateBadges } from '../../utils/opportunity-state'

export type MapHoverCardMarker = {
  kind: 'single' | 'cluster'
  count: number
  opportunities: Opportunity[]
  isFavorite: boolean
}

function resolveIsFavorite(item: Opportunity) {
  return Boolean(item.isFavoriteByMe)
}

export function buildMapHoverCardNode(marker: MapHoverCardMarker) {
  const root = document.createElement('div')
  root.className = 'map-hover-card'

  if (marker.kind === 'cluster') {
    const title = document.createElement('strong')
    title.textContent = `\u0412 \u0442\u043e\u0447\u043a\u0435: ${marker.count}`
    root.append(title)

    const list = document.createElement('div')
    list.className = 'map-hover-card__list'

    marker.opportunities.slice(0, 3).forEach((item) => {
      const row = document.createElement('div')
      row.className = 'map-hover-card__item'

      const itemTitle = document.createElement('p')
      itemTitle.textContent = item.title
      row.append(itemTitle)

      const badges = getOpportunityStateBadges(item, resolveIsFavorite(item))
      if (badges.length) {
        const badgesRow = document.createElement('div')
        badgesRow.className = 'map-hover-card__badges'
        badges.forEach((badge) => {
          const badgeNode = document.createElement('span')
          badgeNode.className = `map-hover-card__badge map-hover-card__badge--${badge.tone}`
          badgeNode.textContent = badge.label
          badgesRow.append(badgeNode)
        })
        row.append(badgesRow)
      }

      list.append(row)
    })

    root.append(list)
    return root
  }

  const [item] = marker.opportunities
  if (!item) {
    return root
  }

  const title = document.createElement('strong')
  title.textContent = item.title
  root.append(title)

  const company = document.createElement('p')
  company.textContent = item.company
  root.append(company)

  const compensation = document.createElement('p')
  compensation.className = 'map-hover-card__compensation'
  compensation.textContent = item.compensation
  root.append(compensation)

  const badges = getOpportunityStateBadges(item, marker.isFavorite)
  if (badges.length) {
    const badgesRow = document.createElement('div')
    badgesRow.className = 'map-hover-card__badges'
    badges.forEach((badge) => {
      const badgeNode = document.createElement('span')
      badgeNode.className = `map-hover-card__badge map-hover-card__badge--${badge.tone}`
      badgeNode.textContent = badge.label
      badgesRow.append(badgeNode)
    })
    root.append(badgesRow)
  }

  return root
}
