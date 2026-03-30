import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { addOpportunityToFavorites, fetchMyFavorites, removeOpportunityFromFavorites } from '../api/favorites'
import { fetchEventsListOpportunities, participateInOpportunity } from '../api/opportunities'
import { FilterModal } from '../components/home/FilterModal'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { useAuth } from '../hooks/useAuth'
import { useCity } from '../contexts/CityContext'
import type { Opportunity, OpportunityFilters, OpportunityType } from '../types/opportunity'
import { getFavoriteEntityType } from '../utils/favorites'
import { applyOpportunitySocialSnapshot } from '../utils/opportunity-social-state'

const defaultFilters: OpportunityFilters = {
  types: ['event'],
  formats: [],
  tagIds: [],
  salaryFrom: null,
  salaryTo: null,
  statuses: [],
  verifiedOnly: false,
}

type FavoriteIdsSnapshot = {
  vacancyIds: Set<number>
  opportunityIds: Set<number>
}

function toFavoriteIdsSnapshot(value: { vacancyIds: number[]; opportunityIds: number[] }): FavoriteIdsSnapshot {
  return {
    vacancyIds: new Set(value.vacancyIds),
    opportunityIds: new Set(value.opportunityIds),
  }
}

function resolveIsFavoriteFromSnapshot(opportunity: Opportunity, snapshot: FavoriteIdsSnapshot | null) {
  if (!snapshot) {
    return opportunity.isFavoriteByMe
  }

  const entityType = getFavoriteEntityType(opportunity)
  return entityType === 'vacancy' ? snapshot.vacancyIds.has(opportunity.id) : snapshot.opportunityIds.has(opportunity.id)
}

export function EventsPage() {
  const { selectedCityId } = useCity()
  const { session } = useAuth()

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [filters, setFilters] = useState<OpportunityFilters>(defaultFilters)
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const [items, setItems] = useState<Opportunity[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState(false)
  const [participatingIds, setParticipatingIds] = useState<Record<number, boolean>>({})
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})
  const [favoriteIdsSnapshot, setFavoriteIdsSnapshot] = useState<FavoriteIdsSnapshot | null>(null)

  const query = useMemo(
    () => ({
      page: 1,
      pageSize: 24,
      search: appliedSearch,
      cityId: selectedCityId,
      filters: {
        ...filters,
        types: ['event'] as OpportunityType[],
      },
    }),
    [appliedSearch, filters, selectedCityId],
  )

  useEffect(() => {
    if (!session?.accessToken) {
      setFavoriteIdsSnapshot(null)
      return
    }

    const controller = new AbortController()
    void fetchMyFavorites(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setFavoriteIdsSnapshot(toFavoriteIdsSnapshot(response))
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFavoriteIdsSnapshot(null)
        }
      })

    return () => controller.abort()
  }, [session?.accessToken, session?.user?.id])

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchEventsListOpportunities(query, signal)
        setItems(response.items.map((item) => ({ ...item, isFavoriteByMe: resolveIsFavoriteFromSnapshot(item, favoriteIdsSnapshot) })))
        setTotal(response.total)
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить мероприятия.')
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [favoriteIdsSnapshot, query],
  )

  useEffect(() => {
    const abortController = new AbortController()
    void loadEvents(abortController.signal)
    return () => abortController.abort()
  }, [loadEvents])

  function handleSearchSubmit(valueOverride?: string) {
    setAppliedSearch((valueOverride ?? searchInput).trim())
  }

  function handleResetFilters() {
    setSearchInput('')
    setAppliedSearch('')
    setFilters(defaultFilters)
  }

  async function handleParticipate(opportunity: Opportunity) {
    if (!session?.accessToken || !session.user?.id) {
      setStatusError(true)
      setStatusMessage('Чтобы записаться на мероприятие, нужно войти в аккаунт соискателя.')
      return
    }

    if (participatingIds[opportunity.id]) {
      setStatusError(false)
      setStatusMessage('Вы уже записались на это мероприятие.')
      return
    }

    setApplyingIds((current) => ({
      ...current,
      [opportunity.id]: true,
    }))

    try {
      await participateInOpportunity(opportunity.id)
      setParticipatingIds((current) => ({
        ...current,
        [opportunity.id]: true,
      }))
      setStatusError(false)
      setStatusMessage('Запись на мероприятие отправлена.')
    } catch (error) {
      setStatusError(true)
      setStatusMessage(error instanceof Error ? error.message : 'Не удалось записаться на мероприятие.')
    } finally {
      setApplyingIds((current) => {
        const next = { ...current }
        delete next[opportunity.id]
        return next
      })
    }
  }

  async function handleToggleFavorite(opportunity: Opportunity, nextValue: boolean) {
    try {
      const snapshot = nextValue
        ? await addOpportunityToFavorites(opportunity.id)
        : await removeOpportunityFromFavorites(opportunity.id)

      applyOpportunitySocialSnapshot(snapshot)
      setItems((current) =>
        current.map((item) =>
          item.id === opportunity.id && getFavoriteEntityType(item) === snapshot.entityType
            ? {
                ...item,
                isFavoriteByMe: snapshot.isFavoriteByMe,
                friendFavoritesCount: snapshot.friendFavoritesCount,
                friendsAppliedCount: snapshot.friendApplicationsCount,
              }
            : item,
        ),
      )
      return snapshot.isFavoriteByMe
    } catch (error) {
      setStatusError(true)
      setStatusMessage(error instanceof Error ? error.message : 'Не удалось обновить избранное.')
      return !nextValue
    }
  }

  const hasFilters =
    filters.formats.length > 0 ||
    filters.statuses.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.salaryFrom != null ||
    filters.salaryTo != null ||
    filters.verifiedOnly ||
    Boolean(appliedSearch.trim())

  return (
    <div className="events-page">
      <section className="events-page__hero">
        <div className="container events-page__hero-inner">
          <div className="events-page__hero-copy">
            <span className="events-page__eyebrow">
              <CalendarDays size={16} />
              Мероприятия
            </span>
            <h1>Мероприятия</h1>
            <p>
              Конференции, митапы, хакатоны и вебинары в одном месте. Смотрите новые события, фильтруйте по формату и
              записывайтесь прямо из карточки.
            </p>
          </div>
        </div>
      </section>

      <section className="container events-page__content">
        <FilterModal
          isOpen={isFiltersModalOpen}
          filters={filters}
          onApply={(nextFilters) =>
            setFilters({
              ...nextFilters,
              types: ['event'],
            })
          }
          onReset={() => setFilters(defaultFilters)}
          onClose={() => setIsFiltersModalOpen(false)}
        />

        {statusMessage ? <div className={`state-card ${statusError ? 'state-card--error' : ''}`}>{statusMessage}</div> : null}

        <div className="events-page__toolbar card">
          <label className="input-wrap input-wrap--wide">
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setAppliedSearch(searchInput.trim())
                }
              }}
              placeholder="Название, тема, компания или город"
            />
          </label>

          <button type="button" className="btn btn--primary" onClick={() => handleSearchSubmit()}>
            Найти
          </button>

          <button type="button" className="btn btn--ghost" onClick={handleResetFilters}>
            <RefreshCw size={16} />
            Сброс
          </button>

          <button type="button" className="btn btn--ghost" onClick={() => setIsFiltersModalOpen(true)}>
            <SlidersHorizontal size={16} />
            Фильтры
          </button>
        </div>

        <div className="events-page__layout">
          <div className="events-page__main">
            <div className="events-page__summary card">
              <div>
                <strong>Найдено: {total}</strong>
                <span>Сначала новые, затем по популярности</span>
              </div>
            </div>

            {isLoading ? <div className="state-card">Загружаем мероприятия...</div> : null}

            {!isLoading && errorMessage ? (
              <div className="state-card state-card--error">
                <p>{errorMessage}</p>
                <button type="button" className="btn btn--ghost" onClick={() => void loadEvents()}>
                  Повторить
                </button>
              </div>
            ) : null}

            {!isLoading && !errorMessage && items.length === 0 ? (
              <div className="state-card">
                {hasFilters ? 'По текущим фильтрам мероприятия не найдены.' : 'Пока нет доступных мероприятий.'}
              </div>
            ) : null}

            {!isLoading && !errorMessage && items.length > 0 ? (
              <div className="events-page__grid">
                {items.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    opportunity={item}
                    isApplying={Boolean(applyingIds[item.id])}
                    isApplied={Boolean(participatingIds[item.id])}
                    onToggleFavorite={(currentOpportunity, nextValue) => handleToggleFavorite(currentOpportunity, nextValue)}
                    onApply={(currentOpportunity) => {
                      void handleParticipate(currentOpportunity)
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
