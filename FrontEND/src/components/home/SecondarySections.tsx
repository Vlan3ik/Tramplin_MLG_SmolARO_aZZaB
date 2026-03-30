import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCompanies } from '../../api/companies'
import type { Company } from '../../types/company'

const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=780&q=80'
const fallbackCompanies: Company[] = [
  {
    id: 0,
    name: 'Company',
    industry: 'Digital products',
    verified: true,
    cityName: 'Smolensk',
    logoUrl: null,
    websiteUrl: null,
    publicEmail: null,
    activeOpportunitiesCount: 18,
  },
  {
    id: -1,
    name: 'Company',
    industry: 'FinTech',
    verified: true,
    cityName: 'Moscow',
    logoUrl: null,
    websiteUrl: null,
    publicEmail: null,
    activeOpportunitiesCount: 14,
  },
  {
    id: -2,
    name: 'Company',
    industry: 'EdTech',
    verified: false,
    cityName: 'Saint Petersburg',
    logoUrl: null,
    websiteUrl: null,
    publicEmail: null,
    activeOpportunitiesCount: 9,
  },
  {
    id: -3,
    name: 'Company',
    industry: 'E-commerce',
    verified: false,
    cityName: 'Kazan',
    logoUrl: null,
    websiteUrl: null,
    publicEmail: null,
    activeOpportunitiesCount: 7,
  },
]

export function SecondarySections() {
  const [companyCards, setCompanyCards] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCompanies() {
      try {
        const response = await fetchCompanies({ page: 1, pageSize: 20 }, controller.signal)
        const sorted = [...response.items].sort((left, right) => {
          if (left.verified !== right.verified) {
            return Number(right.verified) - Number(left.verified)
          }

          if (left.activeOpportunitiesCount !== right.activeOpportunitiesCount) {
            return right.activeOpportunitiesCount - left.activeOpportunitiesCount
          }

          return (left.name ?? '').localeCompare(right.name ?? '')
        })

        setCompanyCards(sorted)
      } catch {
        if (!controller.signal.aborted) {
          setCompanyCards([])
        }
      }
    }

    void loadCompanies()
    return () => controller.abort()
  }, [])

  const cards = companyCards.length ? companyCards : fallbackCompanies
  const topCompanies = cards.slice(0, 6)

  useEffect(() => {
    if (!cards.length) {
      setActiveCompanyId(null)
      return
    }

    if (activeCompanyId === null || !cards.some((card) => card.id === activeCompanyId)) {
      setActiveCompanyId(cards[0].id)
    }
  }, [activeCompanyId, cards])

  const featuredCompany = useMemo(
    () => cards.find((card) => card.id === activeCompanyId) ?? cards[0] ?? null,
    [activeCompanyId, cards],
  )

  if (!featuredCompany) {
    return null
  }

  return (
    <section className="secondary-sections container" aria-label="Top employers">
      <div className="secondary-sections__header">
        <h2 className="secondary-sections__title">Top employers</h2>
        <p className="secondary-sections__subtitle">Interactive shortlist of verified companies with active opportunities.</p>
      </div>

      <div className="secondary-sections__layout">
        <div className="secondary-sections__list" role="tablist" aria-label="Employers list">
          {topCompanies.map((card) => {
            const isActive = card.id === featuredCompany.id
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`secondary-sections__company-button${isActive ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveCompanyId(card.id)}
                onFocus={() => setActiveCompanyId(card.id)}
                onClick={() => setActiveCompanyId(card.id)}
              >
                <span className="secondary-sections__company-name">{card.name ?? 'Company'}</span>
                <span className="secondary-sections__company-meta">
                  {card.industry ?? 'Industry'} - {card.activeOpportunitiesCount} open
                </span>
              </button>
            )
          })}
        </div>

        <div className="secondary-sections__spotlight card" role="tabpanel" aria-live="polite">
          <img
            className="secondary-sections__spotlight-image"
            src={featuredCompany.logoUrl || fallbackImage}
            alt={featuredCompany.name ?? 'Company'}
            loading="lazy"
          />

          <div className="secondary-sections__spotlight-body">
            <span className={`secondary-sections__badge${featuredCompany.verified ? ' is-verified' : ''}`}>
              {featuredCompany.verified ? 'Verified employer' : 'Employer'}
            </span>
            <h3>{featuredCompany.name ?? 'Company'}</h3>
            <p>{featuredCompany.industry ?? 'Industry is not specified'}</p>

            <div className="secondary-sections__stats">
              <span>{featuredCompany.activeOpportunitiesCount} active opportunities</span>
              <span>{featuredCompany.cityName ?? 'All regions'}</span>
            </div>

            <Link className="secondary-sections__link" to={featuredCompany.id > 0 ? `/company/${featuredCompany.id}` : '/companies'}>
              View profile
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
