import { Bookmark, Building2, CheckCircle2, Clock3, MapPin, Send } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Opportunity } from '../../types/opportunity'
import { opportunityStatusLabel, typeLabel } from '../../types/opportunity'
import { isFavoriteOpportunity, subscribeToFavoriteOpportunities, toggleFavoriteOpportunity } from '../../utils/favorites'

type OpportunityCardProps = {
  opportunity: Opportunity
  compact?: boolean
  isApplying?: boolean
  isApplied?: boolean
  onApply?: (opportunity: Opportunity) => void
}

function getApplyLabel(opportunity: Opportunity, isApplying: boolean, isApplied: boolean, isClosed: boolean) {
  if (isApplying) return 'Отправляем...'
  if (isApplied) return 'Отклик отправлен'
  if (isClosed) return 'Закрыто'
  return opportunity.type === 'event' ? 'Записаться' : 'Откликнуться'
}

export function OpportunityCard({ opportunity, compact = false, isApplying = false, isApplied = false, onApply }: OpportunityCardProps) {
  const [isFavorite, setIsFavorite] = useState(() => isFavoriteOpportunity(opportunity.id))
  const favoriteLabel = useMemo(() => (isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'), [isFavorite])
  const isClosed = opportunity.status >= 4

  useEffect(() => {
    const unsubscribe = subscribeToFavoriteOpportunities(() => {
      setIsFavorite(isFavoriteOpportunity(opportunity.id))
    })

    return unsubscribe
  }, [opportunity.id])

  function handleFavoriteToggle() {
    const nextValue = toggleFavoriteOpportunity(opportunity.id)
    setIsFavorite(nextValue)
  }

  return (
    <article className={clsx('opportunity-card card', compact && 'opportunity-card--compact')}>
      <div className="opportunity-card__top">
        <div className="opportunity-card__badges">
          <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
          <span className="status-chip">{opportunityStatusLabel[opportunity.status] ?? `Статус ${opportunity.status}`}</span>
        </div>
        <span className="opportunity-card__compensation">{opportunity.compensation}</span>
      </div>

      <h3>
        <Link to={`/opportunity/${opportunity.id}`} className="opportunity-card__title-link">
          {opportunity.title}
        </Link>
      </h3>

      <div className="opportunity-card__meta-grid">
        <span className="opportunity-card__meta-item">
          <Building2 size={14} />
          {opportunity.company}
        </span>
        <span className="opportunity-card__meta-item">
          <MapPin size={14} />
          {opportunity.location}
        </span>
        <span className="opportunity-card__meta-item">
          <Clock3 size={14} />
          {opportunity.workFormat} • {opportunity.date}
        </span>
      </div>

      <p className="opportunity-card__description">{opportunity.description}</p>

      {opportunity.tags.length ? (
        <div className="tag-row">
          {opportunity.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="opportunity-card__footer">
        <div className="company-status">
          <CheckCircle2 size={14} />
          {opportunity.verified ? 'Компания подтверждена' : 'Проверка компании в процессе'}
          {opportunity.favoriteCompany ? <span className="favorite-company">Избранная компания</span> : null}
        </div>

        <div className="action-row">
          <Link className="btn btn--ghost" to={`/opportunity/${opportunity.id}`}>
            Подробнее
          </Link>
          <button className="btn btn--primary" type="button" disabled={isApplying || isApplied || isClosed} onClick={() => onApply?.(opportunity)}>
            <Send size={15} />
            {getApplyLabel(opportunity, isApplying, isApplied, isClosed)}
          </button>
          <button className={clsx('btn btn--icon', isFavorite && 'btn--icon-active')} type="button" aria-label={favoriteLabel} onClick={handleFavoriteToggle}>
            <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  )
}
