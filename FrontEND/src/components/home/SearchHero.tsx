import { useEffect, useMemo, useRef, useState } from 'react'
import { List, Search, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchSearchSuggestions } from '../../api/search'
import { fetchCompanies } from '../../api/companies'
import type { SearchSuggestItem } from '../../types/search'
import type { Company } from '../../types/company'

type SearchHeroProps = {
  searchValue: string
  viewMode: 'map' | 'list'
  onModeChange: (mode: 'map' | 'list') => void
  onSearchChange: (value: string) => void
  onSearchSubmit: (valueOverride?: string) => void
  onSuggestionSelect: (item: SearchSuggestItem) => void | Promise<void>
  onFiltersClick: () => void
}

const SUGGEST_MIN_QUERY_LENGTH = 2
const SUGGEST_DEBOUNCE_MS = 250
const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=780&q=80'

function formatSuggestMeta(item: SearchSuggestItem) {
  return [item.companyName, item.locationName].filter(Boolean).join(' - ')
}

export function SearchHero({
  searchValue,
  viewMode,
  onModeChange,
  onSearchChange,
  onSearchSubmit,
  onSuggestionSelect,
  onFiltersClick,
}: SearchHeroProps) {
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [isSuggestLoading, setIsSuggestLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([])
  const [suggestError, setSuggestError] = useState('')
  const [topCompanies, setTopCompanies] = useState<Company[]>([])
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(true)
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const shouldLoadSuggest = useMemo(() => searchValue.trim().length >= SUGGEST_MIN_QUERY_LENGTH, [searchValue])
  const activeCompany = useMemo(
    () => topCompanies.find((company) => company.id === activeCompanyId) ?? topCompanies[0] ?? null,
    [activeCompanyId, topCompanies],
  )

  useEffect(() => {
    if (!isSuggestOpen) {
      return
    }

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsSuggestOpen(false)
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSuggestOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEsc)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isSuggestOpen])

  useEffect(() => {
    if (!shouldLoadSuggest) {
      setSuggestions([])
      setSuggestError('')
      setIsSuggestLoading(false)
      return
    }

    const abortController = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setIsSuggestLoading(true)
      setSuggestError('')

      try {
        const response = await fetchSearchSuggestions({
          q: searchValue,
          limit: 10,
          types: ['vacancy', 'opportunity'],
          signal: abortController.signal,
        })

        setSuggestions(response.items)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        setSuggestError(error instanceof Error ? error.message : 'Не удалось загрузить подсказки')
        setSuggestions([])
      } finally {
        if (!abortController.signal.aborted) {
          setIsSuggestLoading(false)
        }
      }
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      abortController.abort()
      window.clearTimeout(timeoutId)
    }
  }, [searchValue, shouldLoadSuggest])

  useEffect(() => {
    const controller = new AbortController()

    async function loadTopCompanies() {
      setIsCompaniesLoading(true)
      try {
        const response = await fetchCompanies({ page: 1, pageSize: 12, verifiedOnly: true }, controller.signal)
        const sorted = [...response.items].sort((left, right) => right.activeOpportunitiesCount - left.activeOpportunitiesCount)
        const shortlisted = sorted.slice(0, 6)
        setTopCompanies(shortlisted)
        setActiveCompanyId(shortlisted[0]?.id ?? null)
      } catch {
        if (!controller.signal.aborted) {
          setTopCompanies([])
          setActiveCompanyId(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCompaniesLoading(false)
        }
      }
    }

    void loadTopCompanies()
    return () => controller.abort()
  }, [])

  function handleSuggestSelect(item: SearchSuggestItem) {
    onSearchChange(item.title)
    onSuggestionSelect(item)
    setIsSuggestOpen(false)
    onSearchSubmit(item.title)
  }

  return (
    <section className="search-hero container">
      <div className="search-hero__search card">
        <div className="search-hero__head">
          <h1>Быстрый поиск карьерных возможностей</h1>
        </div>

        <div className="search-row" ref={rootRef}>
          <label className="input-wrap input-wrap--wide">
            <Search size={18} />
            <input
              value={searchValue}
              onFocus={() => setIsSuggestOpen(true)}
              onChange={(event) => {
                onSearchChange(event.target.value)
                setIsSuggestOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setIsSuggestOpen(false)
                  onSearchSubmit()
                }
              }}
              placeholder="Адрес, должность, компания или мероприятие"
            />

            {isSuggestOpen ? (
              <div className="search-suggest">
                {!shouldLoadSuggest ? <div className="search-suggest__state">Введите минимум 2 символа</div> : null}
                {shouldLoadSuggest && isSuggestLoading ? <div className="search-suggest__state">Ищем подсказки...</div> : null}
                {shouldLoadSuggest && !isSuggestLoading && suggestError ? (
                  <div className="search-suggest__state search-suggest__state--error">{suggestError}</div>
                ) : null}
                {shouldLoadSuggest && !isSuggestLoading && !suggestError && suggestions.length === 0 ? (
                  <div className="search-suggest__state">Подсказки не найдены</div>
                ) : null}
                {shouldLoadSuggest && !isSuggestLoading && !suggestError && suggestions.length > 0 ? (
                  <div className="search-suggest__list">
                    {suggestions.map((item) => (
                      <button key={`${item.entityType}:${item.id}`} type="button" onClick={() => handleSuggestSelect(item)}>
                        <strong>{item.title}</strong>
                        <span>{formatSuggestMeta(item)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </label>

          <button className="btn btn--primary" type="button" onClick={() => onSearchSubmit()}>
            Найти
          </button>

          <button className="btn btn--ghost" type="button" onClick={onFiltersClick}>
            <SlidersHorizontal size={16} />
            Фильтры
          </button>

          <div className="view-switch" role="tablist" aria-label="Режим отображения">
            <button type="button" className={viewMode === 'map' ? 'is-active' : ''} onClick={() => onModeChange('map')}>
              Карта
            </button>
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => onModeChange('list')}>
              <List size={16} />
              Список
            </button>
          </div>
        </div>
      </div>

      <div className="search-hero__iframe" aria-label="Лучшие работодатели">
        <div className="hero-employers">
          <div className="hero-employers__header">
            <strong>Лучшие работодатели</strong>
            <span>Проверенные компании с активными вакансиями</span>
          </div>

          {isCompaniesLoading ? <div className="hero-employers__state">Загружаем компании...</div> : null}

          {!isCompaniesLoading && topCompanies.length === 0 ? (
            <div className="hero-employers__state">Пока нет данных. Откройте общий список компаний.</div>
          ) : null}

          {!isCompaniesLoading && topCompanies.length > 0 && activeCompany ? (
            <>
              <div className="hero-employers__list" role="tablist" aria-label="Список работодателей">
                {topCompanies.map((company) => {
                  const isActive = company.id === activeCompany.id
                  return (
                    <button
                      key={company.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`hero-employers__item${isActive ? ' is-active' : ''}`}
                      onMouseEnter={() => setActiveCompanyId(company.id)}
                      onFocus={() => setActiveCompanyId(company.id)}
                      onClick={() => setActiveCompanyId(company.id)}
                    >
                      <span>{company.name ?? 'Компания'}</span>
                      <small>{company.activeOpportunitiesCount} активных</small>
                    </button>
                  )
                })}
              </div>

              <div className="hero-employers__spotlight">
                <img src={activeCompany.logoUrl || fallbackImage} alt={activeCompany.name ?? 'Компания'} loading="lazy" />
                <div className="hero-employers__meta">
                  <h3>{activeCompany.name ?? 'Компания'}</h3>
                  <p>{activeCompany.industry ?? 'Направление не указано'}</p>
                  <p>{activeCompany.cityName ?? 'Все регионы'}</p>
                </div>
              </div>

              <Link className="hero-employers__link" to={activeCompany.id > 0 ? `/company/${activeCompany.id}` : '/companies'}>
                Подробнее
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
