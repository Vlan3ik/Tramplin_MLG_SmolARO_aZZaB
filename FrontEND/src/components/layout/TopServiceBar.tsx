import { useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCity } from '../../contexts/CityContext'

const POPULAR_CITY_NAMES = [
  'Москва',
  'Санкт-Петербург',
  'Владивосток',
  'Волгоград',
  'Воронеж',
  'Екатеринбург',
  'Казань',
  'Калуга',
  'Краснодар',
]

export function TopServiceBar() {
  const { cities, errorMessage, isLoading, selectedCity, selectedCityId, selectCity } = useCity()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const popularCities = useMemo(
    () =>
      POPULAR_CITY_NAMES.map((name) => cities.find((city) => city.name.toLowerCase() === name.toLowerCase())).filter(
        (city): city is NonNullable<typeof city> => Boolean(city),
      ),
    [cities],
  )

  const filteredCities = useMemo(() => {
    const query = cityQuery.trim().toLowerCase()
    const source = query
      ? cities.filter((city) => `${city.name} ${city.region}`.toLowerCase().includes(query))
      : popularCities.length
        ? popularCities
        : cities

    return source.slice(0, 20)
  }, [cities, cityQuery, popularCities])

  useEffect(() => {
    if (!isPickerOpen) {
      return
    }

    function handleOutsideClick(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false)
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPickerOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isPickerOpen])

  return (
    <div className="service-bar">
      <div className="container service-bar__inner">
        <div className="service-bar__left">
          <div className="service-bar__city-picker" ref={pickerRef}>
            <button
              type="button"
              className="service-bar__city-trigger"
              onClick={() => setIsPickerOpen((current) => !current)}
              aria-haspopup="dialog"
              aria-expanded={isPickerOpen}
            >
              <MapPin size={14} />
              <span>{selectedCity?.name ?? 'Город'}</span>
            </button>

            {isPickerOpen ? (
              <div className="city-picker-panel" role="dialog" aria-label="Найдите ваш город">
                <div className="city-picker-panel__head">
                  <strong>Найдите ваш город</strong>
                  <button type="button" onClick={() => setIsPickerOpen(false)} aria-label="Закрыть">
                    <X size={18} />
                  </button>
                </div>

                <label className="city-picker-panel__search">
                  <Search size={18} />
                  <input
                    value={cityQuery}
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="Поиск по городам"
                    autoFocus
                  />
                </label>

                <div className="city-picker-panel__caption">Популярные города</div>

                <div className="city-picker-panel__list">
                  {filteredCities.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      className={selectedCityId === city.id ? 'is-active' : ''}
                      onClick={() => {
                        selectCity(city.id)
                        setIsPickerOpen(false)
                      }}
                      disabled={isLoading}
                    >
                      <span />
                      <div>
                        <strong>{city.name}</strong>
                        {city.region ? <small>{city.region}</small> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* <div className="service-bar__audience" aria-label="Роли платформы">
            <button type="button" className={activeAudience === 'seekers' ? 'is-active' : ''}>
              Соискателям
            </button>
            <button type="button" className={activeAudience === 'employers' ? 'is-active' : ''}>
              Работодателям
            </button>
          </div> */}

          {errorMessage ? <span className="service-bar__city-error">{errorMessage}</span> : null}
        </div>

        <div className="service-bar__links">
          <Link to="/about">О платформе</Link>
        </div>
      </div>
    </div>
  )
}

