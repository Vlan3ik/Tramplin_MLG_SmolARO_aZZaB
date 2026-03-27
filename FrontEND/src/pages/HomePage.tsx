import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApplication } from '../api/applications'
import { addOpportunityToFavorites, addVacancyToFavorites, removeOpportunityFromFavorites, removeVacancyFromFavorites } from '../api/favorites'
import {
  fetchHomeListOpportunities,
  fetchMapOpportunities,
  fetchOpportunityDetailById,
  participateInOpportunity,
  type MapViewportBounds,
} from '../api/opportunities'
import { FilterModal } from '../components/home/FilterModal'
import { MapBoard } from '../components/home/MapBoard'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { SearchHero } from '../components/home/SearchHero'
import { SecondarySections } from '../components/home/SecondarySections'
import { useApplications } from '../hooks/useApplications'
import { useAuth } from '../hooks/useAuth'
import type { Opportunity, OpportunityFilters } from '../types/opportunity'
import type { SearchSuggestItem } from '../types/search'
import { CommunityTabsSection } from '../components/layout/community-tabs/CommunityTabsSection'
import { EventsCarouselSection } from '../components/layout/events-carousel/EventsCarouselSection'
import { useSearchParams } from 'react-router-dom'
import { useCity } from '../contexts/CityContext'
import { getFavoriteEntityType, toggleFavoriteEntity } from '../utils/favorites'

const defaultFilters: OpportunityFilters = {
  types: [],
  formats: [],
  tagIds: [],
  salaryFrom: null,
  salaryTo: null,
  statuses: [],
  verifiedOnly: false,
}

export function HomePage() {
  const { session } = useAuth()
  const { selectedCity, selectedCityId } = useCity()
  const { hasApplied } = useApplications()
  const [searchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filters, setFilters] = useState<OpportunityFilters>(defaultFilters)
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)

  const [listItems, setListItems] = useState<Opportunity[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [isListLoading, setIsListLoading] = useState(true)
  const [listErrorMessage, setListErrorMessage] = useState('')

  const [mapItems, setMapItems] = useState<Opportunity[]>([])
  const [mapTotal, setMapTotal] = useState(0)
  const [isMapLoading, setIsMapLoading] = useState(false)
  const [mapErrorMessage, setMapErrorMessage] = useState('')
  const [mapBounds, setMapBounds] = useState<MapViewportBounds | null>(null)
  const [mapJumpRequest, setMapJumpRequest] = useState<{ token: number; lngLat: [number, number] } | null>(null)

  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState(false)
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})

  const listQuery = useMemo(
    () => ({
      page: 1,
      pageSize: 24,
      search: appliedSearch,
      cityId: selectedCityId,
      filters,
    }),
    [appliedSearch, filters, selectedCityId],
  )

  const mapQuery = useMemo(
    () => ({
      search: appliedSearch,
      filters,
      bounds: mapBounds,
    }),
    [appliedSearch, filters, mapBounds],
  )

  const loadListOpportunities = useCallback(
    async (signal?: AbortSignal) => {
      setIsListLoading(true)
      setListErrorMessage('')

      try {
        const response = await fetchHomeListOpportunities(listQuery, signal)
        setListItems(response.items)
        setListTotal(response.total)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setListErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить список возможностей.')
      } finally {
        if (!signal?.aborted) {
          setIsListLoading(false)
        }
      }
    },
    [listQuery],
  )

  const loadMapOpportunities = useCallback(
    async (signal?: AbortSignal) => {
      if (!mapQuery.bounds) {
        return
      }

      setIsMapLoading(true)
      setMapErrorMessage('')

      try {
        const response = await fetchMapOpportunities(mapQuery, signal)
        setMapItems(response.items)
        setMapTotal(response.total)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setMapErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить карту возможностей.')
      } finally {
        if (!signal?.aborted) {
          setIsMapLoading(false)
        }
      }
    },
    [mapQuery],
  )

  useEffect(() => {
    const abortController = new AbortController()
    void loadListOpportunities(abortController.signal)
    return () => abortController.abort()
  }, [loadListOpportunities])

  useEffect(() => {
    const requestedView = searchParams.get('view')
    if (requestedView === 'map') {
      setViewMode('map')
    }

    const rawLat = searchParams.get('lat')
    const rawLng = searchParams.get('lng')
    if (rawLat === null || rawLng === null) {
      return
    }

    const lat = Number(rawLat)
    const lng = Number(rawLng)

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapJumpRequest({
        token: Date.now(),
        lngLat: [lng, lat],
      })
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedCity?.latitude == null || selectedCity.longitude == null) {
      return
    }

    setMapJumpRequest({
      token: Date.now(),
      lngLat: [selectedCity.longitude, selectedCity.latitude],
    })
  }, [selectedCityId, selectedCity?.latitude, selectedCity?.longitude])

  useEffect(() => {
    if (viewMode !== 'map' || !mapBounds) {
      return
    }

    const abortController = new AbortController()
    void loadMapOpportunities(abortController.signal)

    return () => abortController.abort()
  }, [loadMapOpportunities, mapBounds, viewMode])

  function handleSearchSubmit(valueOverride?: string) {
    setAppliedSearch((valueOverride ?? searchInput).trim())
  }

  async function handleSuggestionSelect(item: SearchSuggestItem) {
    const selectedText = item.title.trim()
    setViewMode('map')
    setAppliedSearch(selectedText)

    try {
      const response = await fetchMapOpportunities({
        search: selectedText,
        filters,
        bounds: null,
      })

      const target =
        response.items.find((current) => current.id === item.id && current.entityType === item.entityType) ??
        response.items.find((current) => current.id === item.id)

      if (target?.latitude != null && target.longitude != null) {
        setMapJumpRequest({
          token: Date.now(),
          lngLat: [target.longitude, target.latitude],
        })
      }
    } catch {
      // No-op: fallback is regular search filtering without fly-to.
    }
  }

  function handleResetFilters() {
    setFilters(defaultFilters)
  }

  async function handleApply(opportunity: Opportunity) {
    if (opportunity.status >= 4) {
      setActionError(true)
      setActionMessage('Отклик недоступен: карточка закрыта.')
      return
    }

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

      if (detail.type !== 'vacancy' && detail.type !== 'internship') {
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
        vacancyId: detail.id,
        initiatorRole: 1,
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

  async function handleToggleFavorite(opportunity: Opportunity, nextValue: boolean) {
    if (!session?.accessToken) {
      const actualValue = toggleFavoriteEntity(getFavoriteEntityType(opportunity), opportunity.id)
      setListItems((current) =>
        current.map((item) => (item.id === opportunity.id && item.entityType === opportunity.entityType ? { ...item, isFavoriteByMe: actualValue } : item)),
      )
      setMapItems((current) =>
        current.map((item) => (item.id === opportunity.id && item.entityType === opportunity.entityType ? { ...item, isFavoriteByMe: actualValue } : item)),
      )
      return actualValue
    }

    try {
      if (opportunity.entityType === 'vacancy') {
        if (nextValue) {
          await addVacancyToFavorites(opportunity.id)
        } else {
          await removeVacancyFromFavorites(opportunity.id)
        }
      } else {
        if (nextValue) {
          await addOpportunityToFavorites(opportunity.id)
        } else {
          await removeOpportunityFromFavorites(opportunity.id)
        }
      }

      setListItems((current) =>
        current.map((item) => (item.id === opportunity.id && item.entityType === opportunity.entityType ? { ...item, isFavoriteByMe: nextValue } : item)),
      )
      setMapItems((current) =>
        current.map((item) => (item.id === opportunity.id && item.entityType === opportunity.entityType ? { ...item, isFavoriteByMe: nextValue } : item)),
      )

      return nextValue
    } catch (error) {
      setActionError(true)
      setActionMessage(error instanceof Error ? error.message : 'Не удалось обновить избранное.')
      return !nextValue
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
        onSuggestionSelect={handleSuggestionSelect}
        onFiltersClick={() => setIsFiltersModalOpen(true)}
      />

      <FilterModal
        isOpen={isFiltersModalOpen}
        filters={filters}
        onApply={setFilters}
        onReset={handleResetFilters}
        onClose={() => setIsFiltersModalOpen(false)}
      />

      <section className="home-workspace container">
        {actionMessage ? <div className={`state-card ${actionError ? 'state-card--error' : ''}`}>{actionMessage}</div> : null}

        {viewMode === 'map' ? (
          <MapBoard
            opportunities={mapItems}
            total={mapTotal}
            isLoading={isMapLoading}
            errorMessage={mapErrorMessage}
            onRetry={() => {
              void loadMapOpportunities()
            }}
            onBoundsChange={setMapBounds}
            jumpToRequest={mapJumpRequest}
          />
        ) : (
          <div className="list-mode">
            <div className="list-mode__results">
              <div className="result-toolbar card">
                <div>
                  <strong>Найдено: {listTotal}</strong>
                  <span>Сортировка: сначала новые</span>
                </div>
                <button type="button" className="btn btn--ghost" onClick={() => handleSearchSubmit()}>
                  Обновить поиск
                </button>
              </div>

              {isListLoading ? <div className="state-card">Загружаем список возможностей...</div> : null}

              {!isListLoading && listErrorMessage ? (
                <div className="state-card state-card--error">
                  <p>{listErrorMessage}</p>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      void loadListOpportunities()
                    }}
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              {!isListLoading && !listErrorMessage && listItems.length === 0 ? (
                <div className="state-card">Ничего не найдено. Попробуйте изменить фильтры или текст поиска.</div>
              ) : null}

              {!isListLoading && !listErrorMessage && listItems.length > 0 ? (
                <div className="result-list">
                  {listItems.map((item) => (
                    <OpportunityCard
                      key={`${item.entityType ?? item.type}-${item.id}`}
                      opportunity={item}
                      isApplying={Boolean(applyingIds[item.id])}
                      isApplied={hasApplied(item.id)}
                      onToggleFavorite={(currentOpportunity, nextValue) => handleToggleFavorite(currentOpportunity, nextValue)}
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

      <CommunityTabsSection />
      <EventsCarouselSection />


      <SecondarySections />
    </>
  )
}
