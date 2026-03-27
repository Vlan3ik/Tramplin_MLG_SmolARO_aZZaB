import { Bookmark, Send, ShieldAlert, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { useMemo, type KeyboardEvent, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOpportunitySocialState } from '../../hooks/useOpportunitySocialState'
import type { Opportunity } from '../../types/opportunity'
import { typeLabel } from '../../types/opportunity'
import { buildOpportunityDetailsPath } from '../../utils/opportunity-routing'
import { getTagDisplayLabel } from '../../utils/tag-labels'
import { getTagToneClass } from '../../utils/tag-tones'
import { isFavoriteOpportunity, toggleFavoriteOpportunity } from '../../utils/favorites'
import { resolveOpportunitySocialEntityType, setOpportunityFavoriteState } from '../../utils/opportunity-social-state'
import { OpportunityStateBadges } from './OpportunityStateBadges'

type OpportunityCardProps = {
  opportunity: Opportunity
  compact?: boolean
  isApplying?: boolean
  isApplied?: boolean
  onApply?: (opportunity: Opportunity) => void
  onToggleFavorite?: (opportunity: Opportunity, nextValue: boolean) => Promise<boolean | void> | boolean | void
}

function getApplyLabel(opportunity: Opportunity, isApplying: boolean, isApplied: boolean, isClosed: boolean) {
  if (isApplying) return 'Отправляем...'
  if (isApplied) return 'Отклик отправлен'
  if (isClosed) return 'Закрыто'
  return opportunity.type === 'event' ? 'Записаться' : 'Откликнуться'
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return 'К'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function OpportunityCard({ opportunity, compact = false, isApplying = false, isApplied = false, onApply, onToggleFavorite }: OpportunityCardProps) {
  const navigate = useNavigate()
  const socialState = useOpportunitySocialState(opportunity)
  const isFavorite = socialState.isFavoriteByMe || isFavoriteOpportunity(opportunity.id)
  const favoriteLabel = useMemo(() => (isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'), [isFavorite])
  const detailsPath = useMemo(() => buildOpportunityDetailsPath(opportunity), [opportunity])
  const isClosed = opportunity.status >= 4

  function handleOpenDetails() {
    navigate(detailsPath)
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenDetails()
    }
  }

  async function handleFavoriteToggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    const entityType = resolveOpportunitySocialEntityType(opportunity)
    const nextValue = onToggleFavorite ? !isFavorite : toggleFavoriteOpportunity(opportunity.id)
    if (onToggleFavorite) {
      const result = await onToggleFavorite(opportunity, nextValue)
      if (typeof result === 'boolean') {
        setOpportunityFavoriteState(entityType, opportunity.id, result)
        return
      }
    }
    setOpportunityFavoriteState(entityType, opportunity.id, nextValue)
  }

  function handleCompanyClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!opportunity.companyId) {
      return
    }

    navigate(`/company/${opportunity.companyId}`)
  }

  return (
    <article className={clsx('opportunity-card card', compact && 'opportunity-card--compact')} role="link" tabIndex={0} onClick={handleOpenDetails} onKeyDown={handleCardKeyDown}>
      <button className={clsx('btn btn--icon opportunity-card__favorite', isFavorite && 'btn--icon-active')} type="button" aria-label={favoriteLabel} onClick={handleFavoriteToggle}>
        <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
      <OpportunityStateBadges opportunity={opportunity} isFavorite={isFavorite} />

      <div className="opportunity-card__head">
        <div className="opportunity-card__content">
          <div className="opportunity-card__badges">
            <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
          </div>

          <h3 className="opportunity-card__title">{opportunity.title}</h3>

          <button type="button" className="opportunity-card__company" onClick={handleCompanyClick} disabled={!opportunity.companyId}>
            <span className="opportunity-card__company-avatar" aria-hidden="true">
              {opportunity.companyLogoUrl ? <img src={opportunity.companyLogoUrl} alt="" /> : <span>{getInitials(opportunity.company)}</span>}
            </span>
            <span className="opportunity-card__company-name">{opportunity.company}</span>
            <span
              className={clsx('opportunity-card__company-shield', opportunity.verified ? 'is-verified' : 'is-unverified')}
              title={opportunity.verified ? 'Компания подтверждена' : 'Компания еще не подтверждена модерацией.'}
              aria-label={opportunity.verified ? 'Компания подтверждена' : 'Компания еще не подтверждена модерацией.'}
            >
              {opportunity.verified ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            </span>
          </button>

          <p className="opportunity-card__description">{opportunity.description}</p>

          <div className="opportunity-card__meta-line">
            <span>{opportunity.location}</span>
            <span>•</span>
            <span>{opportunity.workFormat}</span>
            <span>•</span>
            <span>{opportunity.date}</span>
          </div>
        </div>

        <div className="opportunity-card__side">
          <span className="opportunity-card__compensation">{opportunity.compensation}</span>
          <div className="action-row">
            <button
              className="btn btn--primary"
              type="button"
              disabled={isApplying || isApplied || isClosed}
              onClick={(event) => {
                event.stopPropagation()
                onApply?.(opportunity)
              }}
            >
              <Send size={15} />
              {getApplyLabel(opportunity, isApplying, isApplied, isClosed)}
            </button>
          </div>
        </div>
      </div>

      {opportunity.tags.length ? (
        <div className="tag-row">
          {opportunity.tags.slice(0, 6).map((tag) => (
            <span key={tag} className={clsx('tag opportunity-tag', getTagToneClass(tag))}>
              {getTagDisplayLabel(tag)}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}
