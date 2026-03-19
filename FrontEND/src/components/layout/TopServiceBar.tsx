import { MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCity } from '../../contexts/CityContext'
import { useAuth } from '../../hooks/useAuth'
import { getDashboardLabelForRole, getDefaultRouteForRole } from '../../utils/auth'

export function TopServiceBar() {
  const { session } = useAuth()
  const {
    cities,
    detectCity,
    errorMessage,
    isDetectingLocation,
    isGeolocationAvailable,
    isLoading,
    selectedCityId,
    selectCity,
  } = useCity()

  const serviceLinks = [
    ...(session?.platformRole
      ? [{ label: getDashboardLabelForRole(session.platformRole), to: getDefaultRouteForRole(session.platformRole) }]
      : []),
    { label: 'О платформе', to: '/about' },
  ]


  return (
    <div className="service-bar">
      <div className="container service-bar__inner">
        <div className="service-bar__city">
          <span className="service-bar__city-label">
            <MapPin size={14} />
            Город
          </span>
          <select
            className="service-bar__city-select"
            value={selectedCityId ?? ''}
            onChange={(event) => selectCity(Number(event.target.value))}
            disabled={isLoading || !cities.length}
            aria-label="Выбор города"
          >
            <option value="" disabled>
              {isLoading ? 'Определяем город...' : 'Выберите город'}
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
                {city.region ? `, ${city.region}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="service-bar__city-action"
            onClick={() => void detectCity()}
            disabled={isLoading || !cities.length || !isGeolocationAvailable}
          >
            {isDetectingLocation ? 'Определяем...' : 'Определить автоматически'}
          </button>
          {errorMessage ? <span className="service-bar__city-error">{errorMessage}</span> : null}
        </div>

        <div className="service-bar__links">
          {serviceLinks.map((link) => (
            <Link key={link.label} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
