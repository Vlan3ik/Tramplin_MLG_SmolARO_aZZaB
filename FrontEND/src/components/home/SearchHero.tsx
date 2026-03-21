import { useEffect, useMemo, useRef, useState } from 'react'
import { List, Search, SlidersHorizontal } from 'lucide-react'
import { fetchSearchSuggestions } from '../../api/search'
import type { SearchSuggestItem } from '../../types/search'

type SearchHeroProps = {
  searchValue: string
  viewMode: 'map' | 'list'
  onModeChange: (mode: 'map' | 'list') => void
  onSearchChange: (value: string) => void
  onSearchSubmit: (valueOverride?: string) => void
  onSuggestionSelect: (item: SearchSuggestItem) => void | Promise<void>
}

const HERO_IFRAME_URL =
  'https://app-472062.games.s3.yandex.net/472062/orblvcxwuye8naqml6g09l4bz8c59wnw_brotli/index.html?sdk=%2Fsdk%2F_%2Fv2.1cfa6241c8b6991a4ef6.js#origin=https%3A%2F%2Fyandex.ru&app-id=472062&device-type=desktop'

const SUGGEST_MIN_QUERY_LENGTH = 2
const SUGGEST_DEBOUNCE_MS = 250

function formatSuggestMeta(item: SearchSuggestItem) {
  return [item.companyName, item.locationName].filter(Boolean).join(' • ')
}

export function SearchHero({
  searchValue,
  viewMode,
  onModeChange,
  onSearchChange,
  onSearchSubmit,
  onSuggestionSelect,
}: SearchHeroProps) {
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [isSuggestLoading, setIsSuggestLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([])
  const [suggestError, setSuggestError] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const shouldLoadSuggest = useMemo(() => searchValue.trim().length >= SUGGEST_MIN_QUERY_LENGTH, [searchValue])

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

          <button className="btn btn--ghost" type="button" aria-disabled="true">
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

      <div className="search-hero__iframe" aria-label="Интерактивный виджет карты">
        <iframe
          src={HERO_IFRAME_URL}
          title="Карта карьерных возможностей"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  )
}
