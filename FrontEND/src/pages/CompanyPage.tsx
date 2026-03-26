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
  if (!normalized) return 'Рљ'

  const parts = normalized.split(/\s+/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'Рљ'
}

function formatAbsoluteDate(value: string | null | undefined) {
  if (!value) return 'РќРµ СѓРєР°Р·Р°РЅРѕ'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'РќРµ СѓРєР°Р·Р°РЅРѕ'

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
        <h3>{opportunity.title ?? 'Р‘РµР· РЅР°Р·РІР°РЅРёСЏ'}</h3>
        <p>
          {opportunity.formatLabel} вЂў РћРїСѓР±Р»РёРєРѕРІР°РЅРѕ: {formatAbsoluteDate(opportunity.publishAt)}
        </p>
      </div>
      <div className="company-profile-opportunity-row__right">
        <span>{opportunity.typeLabel}</span>
        <Link className="btn btn--ghost" to={buildOpportunityDetailsPath({ id: opportunity.id, entityType: opportunity.entityType })}>
          РћС‚РєСЂС‹С‚СЊ
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
      setErrorMessage('РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєРѕРјРїР°РЅРёРё.')
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
        setErrorMessage(error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РєРѕРјРїР°РЅРёРё.')
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
          setFollowErrorMessage(error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃС‚Р°С‚СѓСЃ РїРѕРґРїРёСЃРєРё.')
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
        <div className="state-card">Р—Р°РіСЂСѓР¶Р°РµРј РїСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё...</div>
      </section>
    )
  }

  if (!companyDetail || errorMessage) {
    return (
      <section className="container company-page">
        <div className="state-card state-card--error">{errorMessage || 'РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.'}</div>
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
      setFollowErrorMessage('Р§С‚РѕР±С‹ РїРѕРґРїРёСЃР°С‚СЊСЃСЏ, РІРѕР№РґРёС‚Рµ РІ Р°РєРєР°СѓРЅС‚.')
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
      setFollowErrorMessage(error instanceof Error ? error.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ РїРѕРґРїРёСЃРєСѓ.')
      setIsFollowedByMe((current) => !current)
    } finally {
      setIsFollowSubmitting(false)
    }
  }

  return (
    <section className="company-profile-page">
      <header className="company-profile-hero">
        <div className="company-profile-hero__inner">
          <p className="company-profile-hero__subtitle">{subtitle || 'РџСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё'}</p>
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
                  <a key={`${link.url ?? 'link'}-${index}`} href={link.url ?? '#'} target="_blank" rel="noreferrer" title={link.label ?? link.url ?? 'РЎСЃС‹Р»РєР°'}>
                    <Link2 size={18} />
                  </a>
                ))
              ) : (
                <span>РЎСЃС‹Р»РєРё РЅРµ СѓРєР°Р·Р°РЅС‹</span>
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
            РРЅС„РѕСЂРјР°С†РёСЏ
          </button>
          <button type="button" className={activeTab === 'opportunities' ? 'is-active' : ''} onClick={() => setActiveTab('opportunities')}>
            РђРєС‚РёРІРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё
          </button>
        </nav>

        {activeTab === 'info' ? (
          <section className="company-profile-info">
            <article className="company-profile-card">
              <h2>РРЅС„Рѕ</h2>
              <div className="company-profile-fact-list">
                <div><span>Р“РѕСЂРѕРґ</span><strong>{companyDetail.cityName || 'РќРµ СѓРєР°Р·Р°РЅ'}</strong></div>
                <div><span>Р®СЂРёРґРёС‡РµСЃРєРёРµ РґР°РЅРЅС‹Рµ</span><strong>{companyDetail.legalName || 'РќРµ СѓРєР°Р·Р°РЅС‹'}</strong></div>
                <div><span>Р‘СЂРµРЅРґ</span><strong>{companyDetail.brandName || displayName}</strong></div>
                <div><span>РћС‚СЂР°СЃР»СЊ</span><strong>{companyDetail.industry || 'РќРµ СѓРєР°Р·Р°РЅР°'}</strong></div>
                <div>
                  <span>РЎС‚Р°С‚СѓСЃ</span>
                  <strong className={companyDetail.verified ? 'is-verified' : ''}>
                    {companyDetail.verified ? 'Р’РµСЂРёС„РёС†РёСЂРѕРІР°РЅР°' : 'РќР° РІРµСЂРёС„РёРєР°С†РёРё'}
                  </strong>
                </div>
              </div>

              <h3>Рћ РєРѕРјРїР°РЅРёРё</h3>
              <p>{companyDetail.description || 'РћРїРёСЃР°РЅРёРµ РїРѕРєР° РЅРµ Р·Р°РїРѕР»РЅРµРЅРѕ.'}</p>
            </article>

            <aside className="company-profile-card">
              <h2>РљРѕРЅС‚Р°РєС‚С‹</h2>
              {hasPrimaryContacts ? (
                <div className="company-profile-contacts">
                  <p><Mail size={16} />{companyDetail.publicEmail || 'РџРѕС‡С‚Р° РЅРµ СѓРєР°Р·Р°РЅР°'}</p>
                  <p><Phone size={16} />{companyDetail.publicPhone || 'РўРµР»РµС„РѕРЅ РЅРµ СѓРєР°Р·Р°РЅ'}</p>
                  <p>
                    <Globe size={16} />
                    {companyDetail.websiteUrl ? (
                      <a href={companyDetail.websiteUrl} target="_blank" rel="noreferrer">
                        {companyDetail.websiteUrl}
                      </a>
                    ) : (
                      <span>РЎР°Р№С‚ РЅРµ СѓРєР°Р·Р°РЅ</span>
                    )}
                  </p>
                </div>
              ) : (
                <p>РљРѕРЅС‚Р°РєС‚С‹ РЅРµ СѓРєР°Р·Р°РЅС‹.</p>
              )}

              <h3>РЎСЃС‹Р»РєРё</h3>
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
                  <p>РЎСЃС‹Р»РєРё РЅРµ РґРѕР±Р°РІР»РµРЅС‹.</p>
                )}
              </div>
            </aside>
          </section>
        ) : (
          <section className="company-profile-card company-profile-card--opportunities">
            <div className="company-profile-opportunity-head">
              <h2>РђРєС‚РёРІРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё</h2>
              <span>{companyDetail.activeOpportunities.length}</span>
            </div>
            {companyDetail.activeOpportunities.length ? (
              <div className="company-profile-opportunity-list">
                {companyDetail.activeOpportunities.map((opportunity) => (
                  <CompanyOpportunityRow key={opportunity.id} opportunity={opportunity} />
                ))}
              </div>
            ) : (
              <p>РџРѕРєР° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№.</p>
            )}
          </section>
        )}

        <section className="company-profile-meta">
          <div>
            <ShieldCheck size={16} />
            <span>{companyDetail.verified ? 'РљРѕРјРїР°РЅРёСЏ РїСЂРѕС€Р»Р° РІРµСЂРёС„РёРєР°С†РёСЋ' : 'РљРѕРјРїР°РЅРёСЏ РѕР¶РёРґР°РµС‚ РІРµСЂРёС„РёРєР°С†РёСЋ'}</span>
          </div>
          <div>
            <MapPin size={16} />
            <span>{companyDetail.cityName || 'Р“РѕСЂРѕРґ РЅРµ СѓРєР°Р·Р°РЅ'}</span>
          </div>
          <div>
            <BriefcaseBusiness size={16} />
            <span>{companyDetail.activeOpportunities.length} Р°РєС‚РёРІРЅС‹С… РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№</span>
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

