import { BriefcaseBusiness, Building2, Globe, Link2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCompanyById } from '../api/companies'
import type { CompanyDetail, CompanyOpportunity } from '../types/company'

function getInitials(name: string | null) {
  const normalized = (name ?? '').trim()
  if (!normalized) return 'К'

  const parts = normalized.split(/\s+/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'К'
}

function formatAbsoluteDate(value: string | null | undefined) {
  if (!value) return 'Не указано'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Не указано'

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function CompanyOpportunityRow({ opportunity }: { opportunity: CompanyOpportunity }) {
  return (
    <article className="company-opportunity-row">
      <div className="company-opportunity-row__head">
        <strong>{opportunity.title ?? 'Без названия'}</strong>
        <span className="status-chip">{opportunity.typeLabel}</span>
      </div>
      <div className="company-opportunity-row__meta">
        <span>{opportunity.formatLabel}</span>
        <span>•</span>
        <span>Опубликовано: {formatAbsoluteDate(opportunity.publishAt)}</span>
      </div>
      <Link className="btn btn--ghost" to={`/opportunity/${opportunity.id}`}>
        Открыть возможность
      </Link>
    </article>
  )
}

export function CompanyPage() {
  const { id } = useParams()

  const companyId = useMemo(() => {
    const parsed = Number(id)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [id])

  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!companyId) {
      setIsLoading(false)
      setErrorMessage('Некорректный идентификатор компании.')
      return
    }

    const safeCompanyId = companyId
    const controller = new AbortController()

    async function loadData() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const detail = await fetchCompanyById(safeCompanyId, controller.signal)
        setCompanyDetail(detail)
      } catch (error) {
        if (controller.signal.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить информацию о компании.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()
    return () => controller.abort()
  }, [companyId])

  if (isLoading) {
    return (
      <section className="container company-page">
        <div className="state-card">Загружаем профиль компании...</div>
      </section>
    )
  }

  if (!companyDetail || errorMessage) {
    return (
      <section className="container company-page">
        <div className="state-card state-card--error">{errorMessage || 'Компания не найдена.'}</div>
      </section>
    )
  }

  const displayName = companyDetail.displayName

  return (
    <section className="container company-page">
      <nav className="breadcrumbs">
        <Link to="/">Главная</Link>
        <span>/</span>
        <Link to="/companies">Компании</Link>
        <span>/</span>
        <span>{displayName}</span>
      </nav>

      <header className="company-hero card">
        <div className="company-hero__logo">
          {companyDetail.logoUrl ? <img src={companyDetail.logoUrl} alt={`${displayName} logo`} /> : <span>{getInitials(displayName)}</span>}
        </div>

        <div className="company-hero__main">
          <h1>{displayName}</h1>
          <p>{companyDetail.industry ? `Отрасль: ${companyDetail.industry}` : 'Отрасль не указана'}</p>
          <div className="company-hero__meta">
            {companyDetail.verified ? (
              <span className="status-chip status-chip--success">
                <ShieldCheck size={14} />
                Компания верифицирована
              </span>
            ) : (
              <span className="status-chip">Ожидает верификацию</span>
            )}
            <span className="status-chip">Активные возможности: {companyDetail.activeOpportunities.length}</span>
          </div>
        </div>
      </header>

      <section className="company-layout">
        <article className="card company-panel">
          <h2>О компании</h2>
          <p>{companyDetail.description || 'Описание не заполнено.'}</p>

          <div className="company-info-grid">
            <div className="company-fact">
              <MapPin size={16} />
              <div>
                <strong>Город</strong>
                <span>{companyDetail.cityName || 'Не указано'}</span>
              </div>
            </div>
            <div className="company-fact">
              <Building2 size={16} />
              <div>
                <strong>Юридические данные</strong>
                <span>{companyDetail.legalName || 'Не указано'}</span>
              </div>
            </div>
            <div className="company-fact">
              <BriefcaseBusiness size={16} />
              <div>
                <strong>Бренд</strong>
                <span>{companyDetail.brandName || 'Не указано'}</span>
              </div>
            </div>
            <div className="company-fact">
              <Globe size={16} />
              <div>
                <strong>Сайт</strong>
                {companyDetail.websiteUrl ? (
                  <a href={companyDetail.websiteUrl} target="_blank" rel="noreferrer">
                    {companyDetail.websiteUrl}
                  </a>
                ) : (
                  <span>Не указано</span>
                )}
              </div>
            </div>
          </div>
        </article>

        <aside className="card company-panel company-panel--aside">
          <h2>Контакты</h2>
          <div className="company-contacts">
            <span>
              <Mail size={15} />
              {companyDetail.publicEmail || 'Email не указан'}
            </span>
            <span>
              <Phone size={15} />
              {companyDetail.publicPhone || 'Телефон не указан'}
            </span>
          </div>

          <h3>Ссылки</h3>
          <div className="company-links">
            {companyDetail.links.length ? (
              companyDetail.links.map((link) => (
                <a key={`${link.kind ?? 'link'}-${link.url ?? ''}`} className="status-line" href={link.url ?? '#'} target="_blank" rel="noreferrer">
                  <Link2 size={14} />
                  <span>{link.label ?? link.url ?? 'Ссылка'}</span>
                </a>
              ))
            ) : companyDetail.websiteUrl ? (
              <a className="status-line" href={companyDetail.websiteUrl} target="_blank" rel="noreferrer">
                <Link2 size={14} />
                <span>{companyDetail.websiteUrl}</span>
              </a>
            ) : (
              <p>Ссылки не указаны.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="card company-panel">
        <h2>Активные возможности</h2>
        {companyDetail.activeOpportunities.length ? (
          <div className="company-opportunity-list">
            {companyDetail.activeOpportunities.map((opportunity) => (
              <CompanyOpportunityRow key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        ) : (
          <p>Пока нет активных возможностей.</p>
        )}
      </section>
    </section>
  )
}
