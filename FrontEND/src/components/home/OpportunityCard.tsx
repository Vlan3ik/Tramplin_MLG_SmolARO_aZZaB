import { Bookmark, CheckCircle2, MapPin } from 'lucide-react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { Opportunity } from '../../data/mockData'
import { typeLabel } from '../../data/mockData'

type OpportunityCardProps = {
  opportunity: Opportunity
  compact?: boolean
}

export function OpportunityCard({ opportunity, compact = false }: OpportunityCardProps) {
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
          {opportunity.favoriteCompany && <span className="favorite-company">Избранная компания</span>}
        </div>

        <div className="action-row">
          <Link className="btn btn--ghost" to={`/opportunity/${opportunity.id}`}>
            Подробнее
          </Link>
          <button className="btn btn--primary" type="button">
            {opportunity.type === 'event' ? 'Записаться' : 'Откликнуться'}
          </button>
          <button className="btn btn--icon" type="button" aria-label="Добавить в избранное">
            <Bookmark size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
