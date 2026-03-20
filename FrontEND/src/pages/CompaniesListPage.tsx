import { Building2, Search, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCompanies } from '../api/companies'
import type { Company } from '../types/company'

function normalizeText(value: string | null) {
  return (value ?? '').trim()
}

function getInitials(name: string | null) {
  const normalized = normalizeText(name)
  if (!normalized) return 'К'

  const parts = normalized.split(/\s+/).filter(Boolean)
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'К'
}

function formatCompanyMeta(company: Company) {
  const parts = [company.cityName, company.industry].filter(Boolean)
  return parts.length ? parts.join(' • ') : 'Информация не указана'
}

export function CompaniesListPage() {
  const pageSize = 24

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [companies, setCompanies] = useState<Company[]>([])
  const [total, setTotal] = useState(0)

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const baseQuery = useMemo(
    () => ({
      pageSize,
      search: appliedSearch,
      verifiedOnly,
    }),
    [appliedSearch, verifiedOnly],
  )

  const loadFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setErrorMessage('')
      setCompanies([])
      setPage(1)

      try {
        const response = await fetchCompanies({ page: 1, ...baseQuery }, signal)
        setCompanies(response.items)
        setTotal(response.total)
      } catch (error) {
        if (signal?.aborted) return
        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить список компаний.')
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [baseQuery],
  )

  const loadNextPage = useCallback(async () => {
    const nextPage = page + 1

    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await fetchCompanies({ page: nextPage, ...baseQuery }, undefined)
      setCompanies((current) => [...current, ...response.items])
      setTotal(response.total)
      setPage(nextPage)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить следующую страницу.')
    } finally {
      setIsLoading(false)
    }
  }, [baseQuery, page])

  useEffect(() => {
    const controller = new AbortController()
    void loadFirstPage(controller.signal)
    return () => controller.abort()
  }, [loadFirstPage])

  function handleSearchSubmit() {
    setAppliedSearch(searchInput.trim())
  }

  function handleReset() {
    setSearchInput('')
    setAppliedSearch('')
    setVerifiedOnly(false)
  }

  return (
    <section className="container companies-page">
      <nav className="breadcrumbs">
        <Link to="/">Главная</Link>
        <span>/</span>
        <span>Компании</span>
      </nav>

      <header className="companies-hero card">
        <div className="companies-hero__icon">
          <Building2 size={22} />
        </div>
        <div className="companies-hero__content">
          <h1>Компании платформы</h1>
          <p>Каталог работодателей и партнеров с актуальными возможностями.</p>
        </div>
        <div className="companies-hero__stats">
          <strong>{total}</strong>
          <span>Найдено компаний</span>
        </div>
      </header>

      <div className="companies-toolbar card" role="search">
        <div className="companies-toolbar__row">
          <label className="input-wrap companies-toolbar__search">
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearchSubmit()
                }
              }}
              placeholder="Поиск по названию или отрасли"
            />
          </label>

          <label className="companies-toolbar__toggle">
            <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />
            <span>
              <ShieldCheck size={15} />
              Только верифицированные
            </span>
          </label>

          <button type="button" className="btn btn--primary" onClick={handleSearchSubmit} disabled={isLoading}>
            Найти
          </button>

          <button type="button" className="btn btn--ghost" onClick={handleReset} disabled={isLoading}>
            Сбросить
          </button>
        </div>
      </div>

      {isLoading && page === 1 ? <div className="state-card">Загружаем компании...</div> : null}

      {!isLoading && errorMessage ? <div className="state-card state-card--error">{errorMessage}</div> : null}

      {!isLoading && !errorMessage && companies.length === 0 ? (
        <div className="state-card">Компании не найдены. Измените фильтры или строку поиска.</div>
      ) : null}

      {!errorMessage && companies.length > 0 ? (
        <>
          <div className="company-list">
            {companies.map((company) => (
              <Link key={company.id} className="company-tile" to={`/company/${company.id}`}>
                <div className="company-tile__logo">
                  {company.logoUrl ? <img src={company.logoUrl} alt={company.name ?? 'Логотип компании'} /> : <span>{getInitials(company.name)}</span>}
                </div>

                <div className="company-tile__content">
                  <div className="company-tile__head">
                    <h3>{company.name ?? 'Без названия'}</h3>
                    {company.verified ? (
                      <span className="status-chip status-chip--success">Верифицировано</span>
                    ) : (
                      <span className="status-chip">Без верификации</span>
                    )}
                  </div>

                  <div className="company-tile__meta">{formatCompanyMeta(company)}</div>

                  <div className="company-tile__foot">
                    <span>Активные возможности: {company.activeOpportunitiesCount}</span>
                    {company.websiteUrl ? <small>{company.websiteUrl}</small> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {companies.length < total ? (
            <div className="companies-more">
              <button type="button" className="btn btn--primary" onClick={() => void loadNextPage()} disabled={isLoading}>
                {isLoading ? 'Загружаем...' : 'Показать еще'}
              </button>
            </div>
          ) : (
            <div className="companies-more">
              <span className="state-card">Показаны все доступные компании.</span>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
