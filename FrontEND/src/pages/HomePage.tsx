import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApplication } from '../api/applications'
import { fetchHomeOpportunities, fetchOpportunityDetailById, participateInOpportunity } from '../api/opportunities'
import { FilterSidebar } from '../components/home/FilterSidebar'
import { MapBoard } from '../components/home/MapBoard'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { SearchHero } from '../components/home/SearchHero'
import { SecondarySections } from '../components/home/SecondarySections'
import { useCity } from '../contexts/CityContext'
import { useApplications } from '../hooks/useApplications'
import { useAuth } from '../hooks/useAuth'
import type { Opportunity, OpportunityFilters, OpportunityType } from '../types/opportunity'

const defaultFilters: OpportunityFilters = {
  types: [],
  formats: [],
  verifiedOnly: false,
}

export function HomePage() {
  const { selectedCityId } = useCity()
  const { session } = useAuth()
  const { hasApplied, addApplication } = useApplications()

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filters, setFilters] = useState<OpportunityFilters>(defaultFilters)

  const [items, setItems] = useState<Opportunity[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})

  const query = useMemo(
    () => ({
      page: 1,
      pageSize: 24,
      search: appliedSearch,
      cityId: selectedCityId,
      filters,
    }),
    [appliedSearch, filters, selectedCityId],
  )

  const loadOpportunities = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchHomeOpportunities(query, signal)
        setItems(response.items)
        setTotal(response.total)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить данные главной страницы.')
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [query],
  )

  useEffect(() => {
    const abortController = new AbortController()

    void loadOpportunities(abortController.signal)

    return () => abortController.abort()
  }, [loadOpportunities])

  function handleSearchSubmit() {
    setAppliedSearch(searchInput.trim())
  }

  function handleTypesChange(types: OpportunityType[]) {
    setFilters((current) => ({
      ...current,
      types,
    }))
  }

  function handleFormatsChange(formats: string[]) {
    setFilters((current) => ({
      ...current,
      formats,
    }))
  }

  function handleVerifiedOnlyChange(verifiedOnly: boolean) {
    setFilters((current) => ({
      ...current,
      verifiedOnly,
    }))
  }

  function handleResetFilters() {
    setFilters(defaultFilters)
    setSearchInput('')
    setAppliedSearch('')
  }

  async function handleApply(opportunity: Opportunity) {
    if (!session?.accessToken || !session.user?.id) {
      setActionError(true)
      setActionMessage('Для отклика нужно войти как соискатель.')
      return
    }

    if (hasApplied(opportunity.id)) {
      setActionError(false)
      setActionMessage('Вы уже откликались на эту вакансию.')
      return
    }

    setApplyingIds((current) => ({
      ...current,
      [opportunity.id]: true,
    }))

    try {
      const detail = await fetchOpportunityDetailById(opportunity.id)

      if (detail.type === 'event') {
        await participateInOpportunity(detail.id)
        setActionError(false)
        setActionMessage('Вы успешно записались на мероприятие.')
        return
      }

      if (!detail.companyId) {
        throw new Error('У вакансии не указан идентификатор компании.')
      }

      await createApplication({
        companyId: detail.companyId,
        candidateUserId: session.user.id,
        opportunityId: detail.id,
        initiatorRole: 1,
      })

      addApplication({
        id: detail.id,
        title: detail.title,
        company: detail.company,
        location: detail.location,
      })

      setActionError(false)
      setActionMessage('Отклик отправлен.')
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Не удалось отправить отклик.')
    } finally {
      setApplyingIds((current) => {
        const next = { ...current }
        delete next[opportunity.id]
        return next
      })
    }
  }

  return (
    <>
      <SearchHero
        searchValue={searchInput}
        viewMode={viewMode}
        onModeChange={setViewMode}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
      />

      <section className="home-workspace container">
        {actionMessage ? <div className={`state-card ${actionError ? 'state-card--error' : ''}`}>{actionMessage}</div> : null}

        {viewMode === 'map' ? (
          <MapBoard
            opportunities={items}
            total={total}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onRetry={() => {
              void loadOpportunities()
            }}
          />
        ) : (
          <div className="list-mode">
            <FilterSidebar
              filters={filters}
              onTypesChange={handleTypesChange}
              onFormatsChange={handleFormatsChange}
              onVerifiedOnlyChange={handleVerifiedOnlyChange}
              onReset={handleResetFilters}
            />
            <div className="list-mode__results">
              <div className="result-toolbar card">
                <div>
                  <strong>Найдено: {total}</strong>
                  <span>Сортировка: сначала новые</span>
                </div>
                <button type="button" className="btn btn--ghost" onClick={handleSearchSubmit}>
                  Обновить поиск
                </button>
              </div>

              {isLoading ? (
                <div className="state-card">Загружаем список возможностей...</div>
              ) : null}

              {!isLoading && errorMessage ? (
                <div className="state-card state-card--error">
                  <p>{errorMessage}</p>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      void loadOpportunities()
                    }}
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              {!isLoading && !errorMessage && items.length === 0 ? (
                <div className="state-card">Ничего не найдено. Попробуйте изменить фильтры или текст поиска.</div>
              ) : null}

              {!isLoading && !errorMessage && items.length > 0 ? (
                <div className="result-list">
                  {items.map((item) => (
                    <OpportunityCard
                      key={item.id}
                      opportunity={item}
                      isApplying={Boolean(applyingIds[item.id])}
                      isApplied={hasApplied(item.id)}
                      onApply={(currentOpportunity) => {
                        void handleApply(currentOpportunity)
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <SecondarySections />
    </>
  )
}
