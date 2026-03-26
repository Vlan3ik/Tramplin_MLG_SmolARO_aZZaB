import { BriefcaseBusiness, Building2, Globe, Link2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchCompanyById } from '../api/companies'
import { fetchMyFollowerSubscriptions, fetchMyFollowingSubscriptions, followUser, type SubscriptionUser, unfollowUser } from '../api/subscriptions'
import { useAuth } from '../hooks/useAuth'
import type { CompanyDetail, CompanyOpportunity } from '../types/company'
import { buildOpportunityDetailsPath } from '../utils/opportunity-routing'
import { getSubscriptionActionLabel } from '../utils/subscription-labels'

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
    <article className="company-profile-opportunity-row">
      <div>
        <h3>{opportunity.title ?? 'Без названия'}</h3>
        <p>
          {opportunity.formatLabel} • Опубликовано: {formatAbsoluteDate(opportunity.publishAt)}
        </p>
      </div>
      <div className="company-profile-opportunity-row__right">
        <span>{opportunity.typeLabel}</span>
        <Link className="btn btn--ghost" to={buildOpportunityDetailsPath({ id: opportunity.id, entityType: opportunity.entityType })}>
          Открыть
        </Link>
      </div>
    </article>
  )
}

type CompanyTab = 'info' | 'opportunities'

function normalizeName(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function resolveCompanySubscriptionUserId(following: SubscriptionUser[], detail: CompanyDetail) {
  const companyNames = new Set([normalizeName(detail.displayName), normalizeName(detail.brandName), normalizeName(detail.legalName)].filter(Boolean))

  const byName = following.find((item) => {
    const organizationName = normalizeName(item.organizationName)
    const displayName = normalizeName(item.displayName)
    return companyNames.has(organizationName) || companyNames.has(displayName)
  })

  if (byName) {
    return byName.userId
  }

  const byId = following.find((item) => item.userId === detail.id)
  return byId?.userId ?? null
}

export function CompanyPage() {
  const { id } = useParams()
  const { isAuthenticated } = useAuth()

  const companyId = useMemo(() => {
    const parsed = Number(id)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [id])

  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<CompanyTab>('info')
  const [subscriptionUserId, setSubscriptionUserId] = useState<number | null>(null)
  const [isFollowedByMe, setIsFollowedByMe] = useState(false)
  const [isFollowingMe, setIsFollowingMe] = useState(false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [isFollowSubmitting, setIsFollowSubmitting] = useState(false)
  const [followErrorMessage, setFollowErrorMessage] = useState('')

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

  useEffect(() => {
    if (!companyDetail || !isAuthenticated) {
      setSubscriptionUserId(null)
      setIsFollowedByMe(false)
      setIsFollowingMe(false)
      setIsFollowLoading(false)
      return
    }

    const currentCompany = companyDetail
    const controller = new AbortController()

    async function loadFollowState() {
      setIsFollowLoading(true)
      setFollowErrorMessage('')

      try {
        const [following, followers] = await Promise.all([
          fetchMyFollowingSubscriptions(controller.signal),
          fetchMyFollowerSubscriptions(controller.signal),
        ])
        const followingUserId = resolveCompanySubscriptionUserId(following, currentCompany)
        const followerUserId = resolveCompanySubscriptionUserId(followers, currentCompany)
        setSubscriptionUserId(followingUserId)
        setIsFollowedByMe(followingUserId != null)
        setIsFollowingMe(followerUserId != null)
      } catch (error) {
        if (!controller.signal.aborted) {
          setFollowErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить статус подписки.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFollowLoading(false)
        }
      }
    }

    void loadFollowState()

    return () => controller.abort()
  }, [companyDetail, isAuthenticated])

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
  const subtitle = [companyDetail.industry, companyDetail.cityName].filter(Boolean).join(' ')
  const socialLinks = companyDetail.links.filter((link) => Boolean(link.url)).slice(0, 4)
  const hasPrimaryContacts = Boolean(companyDetail.publicEmail || companyDetail.publicPhone || companyDetail.websiteUrl || companyDetail.links.length)

  async function handleFollowToggle() {
    if (!companyDetail) {
      return
    }

    if (!isAuthenticated) {
      setFollowErrorMessage('Чтобы подписаться, войдите в аккаунт.')
      return
    }

    setFollowErrorMessage('')
    setIsFollowSubmitting(true)

    try {
      if (isFollowedByMe) {
        const targetUserId = subscriptionUserId ?? companyDetail.id
        await unfollowUser(targetUserId)
        setIsFollowedByMe(false)
      } else {
        await followUser(companyDetail.id)
        setIsFollowedByMe(true)
        setSubscriptionUserId(companyDetail.id)
      }

      try {
        const [following, followers] = await Promise.all([
          fetchMyFollowingSubscriptions(),
          fetchMyFollowerSubscriptions(),
        ])
        const followingUserId = resolveCompanySubscriptionUserId(following, companyDetail)
        const followerUserId = resolveCompanySubscriptionUserId(followers, companyDetail)
        setSubscriptionUserId(followingUserId)
        setIsFollowedByMe(followingUserId != null)
        setIsFollowingMe(followerUserId != null)
      } catch {
        // Keep optimistic state when refresh request fails.
      }
    } catch (error) {
      setFollowErrorMessage(error instanceof Error ? error.message : 'Не удалось обновить подписку.')
      setIsFollowedByMe((current) => !current)
    } finally {
      setIsFollowSubmitting(false)
    }
  }

  return (
    <section className="company-profile-page">
      <header className="company-profile-hero">
        <div className="company-profile-hero__inner">
          <p className="company-profile-hero__subtitle">{subtitle || 'Профиль компании'}</p>
          <div className="company-profile-hero__avatar">
            {companyDetail.logoUrl ? <img src={companyDetail.logoUrl} alt={`${displayName} logo`} /> : <span>{getInitials(displayName)}</span>}
          </div>
          {companyDetail.verified ? (
            <span className="company-profile-hero__verified company-profile-hero__verified--floating">
              <ShieldCheck size={28} />
            </span>
          ) : null}
          <h1 className="company-profile-hero__name">{displayName}</h1>
          <div className="company-profile-hero__left">
            <div className="company-profile-hero__socials">
              {socialLinks.length ? (
                socialLinks.map((link, index) => (
                  <a key={`${link.url ?? 'link'}-${index}`} href={link.url ?? '#'} target="_blank" rel="noreferrer" title={link.label ?? link.url ?? 'Ссылка'}>
                    <Link2 size={18} />
                  </a>
                ))
              ) : (
                <span>Ссылки не указаны</span>
              )}
            </div>
          </div>
          <div className="company-profile-hero__actions">
            <button type="button" onClick={() => void handleFollowToggle()} disabled={isFollowSubmitting || isFollowLoading}>
              {isFollowSubmitting ? 'Обновляем...' : getSubscriptionActionLabel(isFollowedByMe, isFollowingMe)}
            </button>
          </div>
        </div>
      </header>

      <div className="container company-profile-page__content">
        <nav className="company-profile-tabs">
          <button type="button" className={activeTab === 'info' ? 'is-active' : ''} onClick={() => setActiveTab('info')}>
            Информация
          </button>
          <button type="button" className={activeTab === 'opportunities' ? 'is-active' : ''} onClick={() => setActiveTab('opportunities')}>
            Активные возможности
          </button>
        </nav>

        {activeTab === 'info' ? (
          <section className="company-profile-info">
            <article className="company-profile-card">
              <h2>Инфо</h2>
              <div className="company-profile-fact-list">
                <div><span>Город</span><strong>{companyDetail.cityName || 'Не указан'}</strong></div>
                <div><span>Юридические данные</span><strong>{companyDetail.legalName || 'Не указаны'}</strong></div>
                <div><span>Бренд</span><strong>{companyDetail.brandName || displayName}</strong></div>
                <div><span>Отрасль</span><strong>{companyDetail.industry || 'Не указана'}</strong></div>
                <div>
                  <span>Статус</span>
                  <strong className={companyDetail.verified ? 'is-verified' : ''}>
                    {companyDetail.verified ? 'Верифицирована' : 'На верификации'}
                  </strong>
                </div>
              </div>

              <h3>О компании</h3>
              <p>{companyDetail.description || 'Описание пока не заполнено.'}</p>
            </article>

            <aside className="company-profile-card">
              <h2>Контакты</h2>
              {hasPrimaryContacts ? (
                <div className="company-profile-contacts">
                  <p><Mail size={16} />{companyDetail.publicEmail || 'Почта не указана'}</p>
                  <p><Phone size={16} />{companyDetail.publicPhone || 'Телефон не указан'}</p>
                  <p>
                    <Globe size={16} />
                    {companyDetail.websiteUrl ? (
                      <a href={companyDetail.websiteUrl} target="_blank" rel="noreferrer">
                        {companyDetail.websiteUrl}
                      </a>
                    ) : (
                      <span>Сайт не указан</span>
                    )}
                  </p>
                </div>
              ) : (
                <p>Контакты не указаны.</p>
              )}

              <h3>Ссылки</h3>
              <div className="company-profile-links">
                {companyDetail.links.length ? (
                  companyDetail.links
                    .filter((link) => Boolean(link.url))
                    .map((link, index) => (
                      <a key={`${link.url ?? 'link'}-${index}`} href={link.url ?? '#'} target="_blank" rel="noreferrer">
                        <Link2 size={14} />
                        <span>{link.label || link.url}</span>
                      </a>
                    ))
                ) : (
                  <p>Ссылки не добавлены.</p>
                )}
              </div>
            </aside>
          </section>
        ) : (
          <section className="company-profile-card company-profile-card--opportunities">
            <div className="company-profile-opportunity-head">
              <h2>Активные возможности</h2>
              <span>{companyDetail.activeOpportunities.length}</span>
            </div>
            {companyDetail.activeOpportunities.length ? (
              <div className="company-profile-opportunity-list">
                {companyDetail.activeOpportunities.map((opportunity) => (
                  <CompanyOpportunityRow key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <p>Пока нет активных возможностей.</p>
            )}
          </section>
        )}

        <section className="company-profile-meta">
          <div>
            <ShieldCheck size={16} />
            <span>{companyDetail.verified ? 'Компания прошла верификацию' : 'Компания ожидает верификацию'}</span>
          </div>
          <div>
            <MapPin size={16} />
            <span>{companyDetail.cityName || 'Город не указан'}</span>
          </div>
          <div>
            <BriefcaseBusiness size={16} />
            <span>{companyDetail.activeOpportunities.length} активных возможностей</span>
          </div>
          <div>
            <Building2 size={16} />
            <span>{companyDetail.legalName || displayName}</span>
          </div>
        </section>

        {followErrorMessage ? <div className="auth-feedback auth-feedback--error">{followErrorMessage}</div> : null}
      </div>
    </section>
  )
}
