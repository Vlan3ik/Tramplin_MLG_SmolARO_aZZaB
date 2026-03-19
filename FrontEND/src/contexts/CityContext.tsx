import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { fetchCities } from '../api/catalog'
import type { City } from '../types/catalog'

const CITY_STORAGE_KEY = 'tramplin.selected.city'

type CitySelectionSource = 'default' | 'geolocation' | 'manual' | 'saved'

type CityContextValue = {
  cities: City[]
  errorMessage: string
  isLoading: boolean
  selectedCity: City | null
  selectedCityId: number | null
  selectionSource: CitySelectionSource | null
  selectCity: (cityId: number) => void
}

const CityContext = createContext<CityContextValue | null>(null)

let citiesCache: City[] | null = null
let geolocationPromise: Promise<GeolocationCoordinates | null> | null = null

function isBrowser() {
  return typeof window !== 'undefined'
}

function readSavedCityId() {
  if (!isBrowser()) {
    return null
  }

  const rawValue = window.localStorage.getItem(CITY_STORAGE_KEY)
  const numericValue = rawValue ? Number(rawValue) : Number.NaN

  return Number.isFinite(numericValue) ? numericValue : null
}

function persistCityId(cityId: number) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(CITY_STORAGE_KEY, String(cityId))
}

function resolveFallbackCityId(cities: City[]) {
  const preferredCity = cities.find((city) => city.name.toLowerCase() === 'москва')
  return preferredCity?.id ?? cities[0]?.id ?? null
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function findNearestCity(cities: City[], latitude: number, longitude: number) {
  let nearestCity: City | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const city of cities) {
    if (city.latitude === null || city.longitude === null) {
      continue
    }

    const distance = calculateDistanceKm(latitude, longitude, city.latitude, city.longitude)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestCity = city
    }
  }

  return nearestCity
}

function requestBrowserGeolocation() {
  if (!isBrowser() || !('geolocation' in navigator)) {
    return Promise.resolve<GeolocationCoordinates | null>(null)
  }

  if (!geolocationPromise) {
    geolocationPromise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 300000,
        },
      )
    })
  }

  return geolocationPromise
}

type CityProviderProps = {
  children: ReactNode
}

export function CityProvider({ children }: CityProviderProps) {
  const [cities, setCities] = useState<City[]>([])
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null)
  const [selectionSource, setSelectionSource] = useState<CitySelectionSource | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoadingCities, setIsLoadingCities] = useState(true)
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const userSelectedRef = useRef(false)

  useEffect(() => {
    const abortController = new AbortController()
    let isDisposed = false

    async function loadCatalog() {
      setIsLoadingCities(true)
      setErrorMessage('')

      try {
        const loadedCities = citiesCache ?? (await fetchCities(abortController.signal))

        if (isDisposed) {
          return
        }

        citiesCache = loadedCities
        setCities(loadedCities)

        const savedCityId = readSavedCityId()
        const savedCity = savedCityId ? loadedCities.find((city) => city.id === savedCityId) : null

        if (savedCity) {
          setSelectedCityId(savedCity.id)
          setSelectionSource('saved')
          return
        }

        const fallbackCityId = resolveFallbackCityId(loadedCities)

        if (!fallbackCityId) {
          return
        }

        setIsDetectingLocation(true)
        const coordinates = await requestBrowserGeolocation()

        if (isDisposed || userSelectedRef.current) {
          return
        }

        const nearestCity =
          coordinates === null
            ? null
            : findNearestCity(loadedCities, coordinates.latitude, coordinates.longitude)

        const resolvedCityId = nearestCity?.id ?? fallbackCityId
        const resolvedSource: CitySelectionSource = nearestCity ? 'geolocation' : 'default'

        setSelectedCityId(resolvedCityId)
        setSelectionSource(resolvedSource)
        persistCityId(resolvedCityId)
      } catch (error) {
        if (abortController.signal.aborted || isDisposed) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Не удалось загрузить список городов.')
      } finally {
        if (!isDisposed) {
          setIsLoadingCities(false)
          setIsDetectingLocation(false)
        }
      }
    }

    void loadCatalog()

    return () => {
      isDisposed = true
      abortController.abort()
    }
  }, [])

  function selectCity(cityId: number) {
    userSelectedRef.current = true
    setSelectedCityId(cityId)
    setSelectionSource('manual')
    persistCityId(cityId)
  }

  const selectedCity = cities.find((city) => city.id === selectedCityId) ?? null

  return (
    <CityContext.Provider
      value={{
        cities,
        errorMessage,
        isLoading: isLoadingCities || isDetectingLocation,
        selectedCity,
        selectedCityId,
        selectionSource,
        selectCity,
      }}
    >
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  const context = useContext(CityContext)

  if (!context) {
    throw new Error('useCity must be used within CityProvider')
  }

  return context
}
