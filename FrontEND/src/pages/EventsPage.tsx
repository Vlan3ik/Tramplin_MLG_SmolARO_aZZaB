import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { fetchHomeListOpportunities, participateInOpportunity } from '../api/opportunities'
import { OpportunityCard } from '../components/home/OpportunityCard'
import { useAuth } from '../hooks/useAuth'
import { useCity } from '../contexts/CityContext'
import type { Opportunity, OpportunityType } from '../types/opportunity'

const defaultFormats = ['remote', 'hybrid', 'onsite']

export function EventsPage() {
  const { selectedCityId } = useCity()
  const { session } = useAuth()

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [formats, setFormats] = useState<string[]>([])
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [items, setItems] = useState<Opportunity[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState(false)
  const [participatingIds, setParticipatingIds] = useState<Record<number, boolean>>({})
  const [applyingIds, setApplyingIds] = useState<Record<number, boolean>>({})

  const query = useMemo(
    () => ({
      page: 1,
      pageSize: 24,
      search: appliedSearch,
      cityId: selectedCityId,
      filters: {
        types: ['event'] as OpportunityType[],
        formats,
        verifiedOnly,
      },
    }),
    [appliedSearch, formats, selectedCityId, verifiedOnly],
  )

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await fetchHomeListOpportunities(query, signal)
        const eventItems = response.items.filter((item) => item.type === 'event')
        setItems(eventItems)
        setTotal(eventItems.length)
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
    [query],
  )

  useEffect(() => {
    const abortController = new AbortController()
    void loadEvents(abortController.signal)
    return () => abortController.abort()
  }, [loadEvents])

  function handleSearchSubmit(valueOverride?: string) {
    setAppliedSearch((valueOverride ?? searchInput).trim())
  }

  function toggleFormat(value: string) {
    setFormats((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  function handleResetFilters() {
    setSearchInput('')
    setAppliedSearch('')
    setFormats([])
    setVerifiedOnly(false)
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

  const hasFilters = formats.length > 0 || verifiedOnly || Boolean(appliedSearch.trim())

  return (
    <div className="events-page">
      <section className="events-page__hero">
        <div className="container events-page__hero-inner">
          <div className="events-page__hero-copy">
            <span className="events-page__eyebrow">
              <CalendarDays size={16} />
              Раздел мероприятий
            </span>
            <h1>Мероприятия</h1>
            <p>
              Конференции, митапы, хакатоны и вебинары в одном месте. Смотрите новые события, фильтруйте по формату и
              записывайтесь прямо из карточки.
            </p>
          </div>

          <div className="events-page__hero-card card">
            <strong>Почему это удобно</strong>
            <ul>
              <li>Актуальные события из API</li>
              <li>Единый стиль карточек с главной</li>
              <li>Быстрая запись в один клик</li>
            </ul>
            <Link className="btn btn--primary" to="/vacancy-flow?type=event">
              Создать мероприятие
            </Link>
          </div>
        </div>
      </section>

      <section className="container events-page__content">
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

          <button type="button" className="btn btn--ghost" aria-disabled="true">
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
              <div className="events-page__chips">
                {defaultFormats.map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={formats.includes(format) ? 'is-active' : ''}
                    onClick={() => toggleFormat(format)}
                  >
                    {format === 'remote' ? 'Онлайн' : format === 'hybrid' ? 'Гибрид' : 'Офлайн'}
                  </button>
                ))}
                <button
                  type="button"
                  className={verifiedOnly ? 'is-active' : ''}
                  onClick={() => setVerifiedOnly((current) => !current)}
                >
                  <CheckCircle2 size={14} />
                  Проверенные
                </button>
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
                    onApply={(currentOpportunity) => {
                      void handleParticipate(currentOpportunity)
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <aside className="events-page__aside card">
            <strong>Что внутри</strong>
            <p>Страница подхватывает данные из общего слоя `opportunities` и показывает только мероприятия.</p>
            <ul>
              <li>Поиск по названию, теме и компании</li>
              <li>Фильтр по формату участия</li>
              <li>Отдельная запись в мероприятие из карточки</li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  )
}
