import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from 'react-router-dom'
import type { Opportunity } from '../../types/opportunity'
import { buildOpportunityDetailsPath } from '../../utils/opportunity-routing'
import { OpportunityStateBadges } from './OpportunityStateBadges'
import {
  isMapItemViewed,
  markMapItemViewed,
  subscribeToViewedMapItems,
  type ViewedMapEntityType,
} from '../../utils/viewedMapItems'
import {
  readOpportunitySocialState,
  subscribeToOpportunitySocialState,
  upsertOpportunitySocialStates,
} from '../../utils/opportunity-social-state'
import { cartoStyle } from './mapStyle'
import { buildMapHoverCardNode } from './map-hover-card'

type MarkerKind = 'single' | 'cluster'
type MarkerTone = 'vacancy-like' | 'event'

type OpportunityMarker = {
  id: string
  lngLat: [number, number]
  kind: MarkerKind
  tone: MarkerTone
  isViewed: boolean
  isFavorite: boolean
  hasFriendsFavorite: boolean
  entityType: ViewedMapEntityType | null
  opportunityId: number | null
  count: number
  opportunities: Opportunity[]
}

type MapBoardProps = {
  opportunities: Opportunity[]
  total: number
  isLoading: boolean
  errorMessage: string
  onRetry: () => void
  onBoundsChange: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void
  jumpToRequest: { token: number; lngLat: [number, number] } | null
}

function resolveEntityType(item: Opportunity): ViewedMapEntityType {
  if (item.entityType) {
    return item.entityType
  }

  return item.type === 'vacancy' || item.type === 'internship' ? 'vacancy' : 'opportunity'
}

function resolveIsFavorite(item: Opportunity) {
  return readOpportunitySocialState(item).isFavoriteByMe
}

export function MapBoard({ opportunities, total, isLoading, errorMessage, onRetry, onBoundsChange, jumpToRequest }: MapBoardProps) {
  const navigate = useNavigate()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapMarkersRef = useRef<maplibregl.Marker[]>([])
  const hasAutoFittedRef = useRef(false)
  const boundsDebounceRef = useRef<number | null>(null)
  const ignoreNextMoveEndRef = useRef(false)
  const lastJumpTokenRef = useRef<number | null>(null)
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null)
  const [markersVersion, setMarkersVersion] = useState(0)
  const [activePoint, setActivePoint] = useState<OpportunityMarker | null>(null)

  useEffect(() => {
    upsertOpportunitySocialStates(opportunities)
  }, [opportunities])

  const markerData = useMemo<OpportunityMarker[]>(() => {
    const groups = new Map<
      string,
      {
        lngLat: [number, number]
        opportunities: Opportunity[]
      }
    >()

    opportunities
      .filter((item) => item.latitude != null && item.longitude != null)
      .forEach((item) => {
        const lngLat: [number, number] = [item.longitude as number, item.latitude as number]
        const key = `${lngLat[0]}|${lngLat[1]}`
        const group = groups.get(key)

        if (!group) {
          groups.set(key, {
            lngLat,
            opportunities: [item],
          })
          return
        }

        group.opportunities.push(item)
      })

    return Array.from(groups.entries()).map(([key, group]) => {
      const enrichedOpportunities = group.opportunities.map((item) => {
        const socialState = readOpportunitySocialState(item)
        return {
          ...item,
          isFavoriteByMe: socialState.isFavoriteByMe,
          friendFavoritesCount: socialState.friendFavoritesCount,
          friendsAppliedCount: socialState.friendsAppliedCount,
        }
      })

      const hasOnlyEvents = enrichedOpportunities.every((item) => item.type === 'event')
      const tone: MarkerTone = hasOnlyEvents ? 'event' : 'vacancy-like'
      const isGroupViewed = enrichedOpportunities.some((item) => isMapItemViewed(resolveEntityType(item), item.id))
      const isGroupFavorite = enrichedOpportunities.some((item) => resolveIsFavorite(item))
      const hasGroupFriendsFavorite = enrichedOpportunities.some((item) => item.friendFavoritesCount > 0)

      if (enrichedOpportunities.length > 1) {
        return {
          id: key,
          lngLat: group.lngLat,
          kind: 'cluster' as const,
          tone,
          isViewed: isGroupViewed,
          isFavorite: isGroupFavorite,
          hasFriendsFavorite: hasGroupFriendsFavorite,
          entityType: null,
          opportunityId: null,
          count: enrichedOpportunities.length,
          opportunities: enrichedOpportunities,
        }
      }

      const [singleItem] = enrichedOpportunities
      const entityType = resolveEntityType(singleItem)

      return {
        id: `single-${singleItem.id}`,
        lngLat: group.lngLat,
        kind: 'single' as const,
        tone,
        isViewed: isMapItemViewed(entityType, singleItem.id),
        isFavorite: resolveIsFavorite(singleItem),
        hasFriendsFavorite: singleItem.friendFavoritesCount > 0,
        entityType,
        opportunityId: singleItem.id,
        count: 1,
        opportunities: enrichedOpportunities,
      }
    })
  }, [markersVersion, opportunities])

  useEffect(() => {
    const unsubscribeSocial = subscribeToOpportunitySocialState(() => {
      setMarkersVersion((current) => current + 1)
    })
    const unsubscribeViewed = subscribeToViewedMapItems(() => {
      setMarkersVersion((current) => current + 1)
    })

    return () => {
      unsubscribeSocial()
      unsubscribeViewed()
    }
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: cartoStyle,
      center: [37.6176, 55.7558],
      zoom: 4.5,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    hoverPopupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: true,
      className: 'map-hover-popup',
      offset: 14,
      maxWidth: '320px',
    })

    const emitBounds = () => {
      const bounds = map.getBounds()
      onBoundsChange({
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      })
    }

    const handleMoveEnd = () => {
      if (ignoreNextMoveEndRef.current) {
        ignoreNextMoveEndRef.current = false
      } else {
        setActivePoint(null)
      }

      if (boundsDebounceRef.current != null) {
        window.clearTimeout(boundsDebounceRef.current)
      }

      boundsDebounceRef.current = window.setTimeout(() => {
        emitBounds()
      }, 300)
    }

    map.on('load', emitBounds)
    map.on('moveend', handleMoveEnd)

    mapRef.current = map

    return () => {
      map.off('moveend', handleMoveEnd)
      map.off('load', emitBounds)
      if (boundsDebounceRef.current != null) {
        window.clearTimeout(boundsDebounceRef.current)
      }
      hoverPopupRef.current?.remove()
      mapMarkersRef.current.forEach((marker) => marker.remove())
      mapMarkersRef.current = []
      map.remove()
      mapRef.current = null
      hoverPopupRef.current = null
    }
  }, [onBoundsChange])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    mapMarkersRef.current.forEach((marker) => marker.remove())
    mapMarkersRef.current = []

    if (!markerData.length) {
      return
    }

    const newMarkers = markerData
      .map((marker) => {
        const markerElement = document.createElement('button')
        markerElement.type = 'button'
        markerElement.className = `map-marker map-marker--${marker.kind} map-marker--tone-${marker.tone} ${marker.isViewed ? 'map-marker--viewed' : ''} ${marker.isFavorite ? 'map-marker--favorite' : ''} ${marker.hasFriendsFavorite ? 'map-marker--friends-favorite' : ''}`
        markerElement.dataset.kind = marker.kind
        markerElement.ariaLabel = 'Метка возможности на карте'

        const circle = document.createElement('span')
        circle.className = 'map-marker__circle'
        markerElement.append(circle)

        if (marker.kind === 'single' && marker.isFavorite) {
          const favoriteBadge = document.createElement('span')
          favoriteBadge.className = 'map-marker__favorite'
          favoriteBadge.textContent = '★'
          markerElement.append(favoriteBadge)
        }

        if (marker.hasFriendsFavorite) {
          const friendsBadge = document.createElement('span')
          friendsBadge.className = 'map-marker__friends-favorite'
          friendsBadge.textContent = 'FR'
          markerElement.append(friendsBadge)
        }

        if (marker.kind === 'cluster') {
          const badge = document.createElement('span')
          badge.className = 'map-marker__count'
          badge.textContent = String(marker.count)
          markerElement.append(badge)
        }

        markerElement.addEventListener('click', () => {
          setActivePoint(marker)

          marker.opportunities.forEach((item) => {
            markMapItemViewed(resolveEntityType(item), item.id)
          })
          markerElement.classList.add('map-marker--viewed')

          ignoreNextMoveEndRef.current = true
          map.flyTo({
            center: marker.lngLat,
            zoom: marker.kind === 'cluster' ? Math.min(map.getZoom() + 2, 11) : 10.8,
            speed: 0.9,
            curve: 1.35,
            essential: true,
          })
        })

        markerElement.addEventListener('mouseenter', () => {
          const popup = hoverPopupRef.current
          if (!popup) {
            return
          }

          popup
            .setLngLat(marker.lngLat)
            .setDOMContent(buildMapHoverCardNode(marker))
            .addTo(map)
        })

        markerElement.addEventListener('mouseleave', () => {
          hoverPopupRef.current?.remove()
        })

        return new maplibregl.Marker({
          element: markerElement,
          anchor: 'center',
        })
          .setLngLat(marker.lngLat)
          .addTo(map)
      })
      .filter((marker): marker is maplibregl.Marker => marker !== null)

    mapMarkersRef.current = newMarkers

    if (!hasAutoFittedRef.current && markerData.length > 0) {
      const bounds = markerData.reduce(
        (acc, marker) => acc.extend(marker.lngLat),
        new maplibregl.LngLatBounds(markerData[0].lngLat, markerData[0].lngLat),
      )

      map.fitBounds(bounds, {
        padding: { top: 140, right: 80, bottom: 90, left: 420 },
        duration: 900,
        maxZoom: 8,
      })

      hasAutoFittedRef.current = true
    }
  }, [markerData])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !jumpToRequest) {
      return
    }

    if (lastJumpTokenRef.current === jumpToRequest.token) {
      return
    }

    lastJumpTokenRef.current = jumpToRequest.token
    hasAutoFittedRef.current = true
    map.flyTo({
      center: jumpToRequest.lngLat,
      zoom: Math.max(map.getZoom(), 11),
      speed: 0.85,
      curve: 1.25,
      essential: true,
    })
  }, [jumpToRequest])

  const displayedItems = activePoint ? activePoint.opportunities : opportunities

  return (
    <section className="map-mode">
      <div className="map-results card">
        <h3>{activePoint ? `Возможности в точке: ${activePoint.opportunities[0]?.location ?? 'локация'}` : `Найдено ${total} возможностей`}</h3>
        {activePoint ? <p>{`Показаны ${activePoint.count} возможностей в выбранной точке.`}</p> : null}

        {isLoading ? <div className="state-card">Загружаем карту и подборку...</div> : null}
        {!isLoading && errorMessage ? (
          <div className="state-card state-card--error">
            <p>{errorMessage}</p>
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              Повторить
            </button>
          </div>
        ) : null}
        {!isLoading && !errorMessage && opportunities.length === 0 ? <div className="state-card">По вашему запросу ничего не найдено.</div> : null}

        {!isLoading && !errorMessage && opportunities.length > 0 ? (
          <div className="map-results__list" id="map-point-results">
            {activePoint ? (
              <button type="button" className="btn btn--ghost" onClick={() => setActivePoint(null)}>
                Показать общий список
              </button>
            ) : null}
            {displayedItems.map((item) => (
              <article
                key={`${resolveEntityType(item)}-${item.id}`}
                className="map-mini-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(buildOpportunityDetailsPath(item))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(buildOpportunityDetailsPath(item))
                  }
                }}
              >
                <div className="map-mini-card__head">
                  <h4>{item.title}</h4>
                  <span className="map-mini-card__company">{item.company}</span>
                </div>
                <div className="map-mini-card__salary">{item.compensation}</div>
                <OpportunityStateBadges opportunity={item} isFavorite={resolveIsFavorite(item)} compact />
                <div className="tag-row">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="map-canvas card" role="img" aria-label="Карта возможностей">
        <div ref={mapContainerRef} className="map-canvas__inner" />
      </div>
    </section>
  )
}
