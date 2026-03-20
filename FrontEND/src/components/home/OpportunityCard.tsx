import { Bookmark, CheckCircle2, MapPinned, MapPin, Send } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Opportunity } from '../../types/opportunity'
import { typeLabel } from '../../types/opportunity'
import { isFavoriteOpportunity, subscribeToFavoriteOpportunities, toggleFavoriteOpportunity } from '../../utils/favorites'

type OpportunityCardProps = {
  opportunity: Opportunity
  compact?: boolean
  isApplying?: boolean
  isApplied?: boolean
  onApply?: (opportunity: Opportunity) => void
}

function buildMapLink(opportunity: Opportunity) {
  if (typeof opportunity.latitude === 'number' && typeof opportunity.longitude === 'number') {
    return `https://yandex.ru/maps/?ll=${opportunity.longitude}%2C${opportunity.latitude}&z=14&pt=${opportunity.longitude},${opportunity.latitude},pm2blm`
  }

  return `https://yandex.ru/maps/?text=${encodeURIComponent(opportunity.location)}`
}

export function OpportunityCard({ opportunity, compact = false, isApplying = false, isApplied = false, onApply }: OpportunityCardProps) {
  const [isFavorite, setIsFavorite] = useState(() => isFavoriteOpportunity(opportunity.id))
  const favoriteLabel = useMemo(() => (isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'), [isFavorite])

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
        <span className={`badge badge--${opportunity.type}`}>{typeLabel[opportunity.type]}</span>
        <span className="opportunity-card__compensation">{opportunity.compensation}</span>
      </div>

      <h3>{opportunity.title}</h3>

      <div className="opportunity-meta">
        <span>{opportunity.company}</span>
        <span>
          <MapPin size={14} />
          {opportunity.location}
        </span>
        <span>{opportunity.workFormat}</span>
        <span>{opportunity.date}</span>
      </div>

      <p>{opportunity.description}</p>

      <div className="tag-row">
        {opportunity.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>

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
          <a className="btn btn--ghost" href={buildMapLink(opportunity)} target="_blank" rel="noreferrer">
            <MapPinned size={15} />
            На карте
          </a>
          <button className="btn btn--primary" type="button" disabled={isApplying || isApplied} onClick={() => onApply?.(opportunity)}>
            <Send size={15} />
            {isApplying ? 'Отправляем...' : isApplied ? 'Отклик отправлен' : opportunity.type === 'event' ? 'Записаться' : 'Откликнуться'}
          </button>
          <button className={clsx('btn btn--icon', isFavorite && 'btn--icon-active')} type="button" aria-label={favoriteLabel} onClick={handleFavoriteToggle}>
            <Bookmark size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  )
}
