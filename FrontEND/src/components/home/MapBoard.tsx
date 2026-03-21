import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Link } from 'react-router-dom'
import type { Opportunity } from '../../types/opportunity'
import { cartoStyle } from './mapStyle'

type MarkerKind = 'single' | 'verified' | 'cluster'

type OpportunityMarker = {
  id: string
  lngLat: [number, number]
  kind: MarkerKind
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

function createOpportunityTags(tags: string[]) {
  const tagRow = document.createElement('div')
  tagRow.className = 'map-popup__tags'

  tags.slice(0, 3).forEach((tagName) => {
    const tag = document.createElement('span')
    tag.className = 'map-popup__tag'
    tag.textContent = tagName
    tagRow.append(tag)
  })

  return tagRow
}

function createPopupContent(
  marker: OpportunityMarker,
  onOpenCluster: (clusterMarker: OpportunityMarker) => void,
) {
  const wrapper = document.createElement('div')
  wrapper.className = `map-popup ${marker.kind === 'cluster' ? 'map-popup--cluster' : 'map-popup--single'}`

  if (marker.kind === 'cluster') {
    const title = document.createElement('strong')
    title.className = 'map-popup__title'
    title.textContent = `${marker.count} вакансий в этой точке`

    const hint = document.createElement('span')
    hint.className = 'map-popup__hint'
    hint.textContent = 'Откройте полный список в левой панели.'

    const preview = document.createElement('div')
    preview.className = 'map-popup__preview'

    marker.opportunities.slice(0, 2).forEach((opportunity) => {
      const previewRow = document.createElement('span')
      previewRow.textContent = `${opportunity.title} • ${opportunity.company}`
      preview.append(previewRow)
    })

    const openButton = document.createElement('button')
    openButton.type = 'button'
    openButton.className = 'map-popup__action'
    openButton.textContent = 'Показать все вакансии в точке'
    openButton.addEventListener('click', () => onOpenCluster(marker))

    wrapper.append(title, hint, preview, openButton)
    return wrapper
  }

  const opportunity = marker.opportunities[0]

  const top = document.createElement('div')
  top.className = 'map-popup__top'

  const badge = document.createElement('span')
  badge.className = `badge badge--${opportunity.type}`
  badge.textContent =
    opportunity.type === 'event'
      ? 'Событие'
      : opportunity.type === 'internship'
        ? 'Стажировка'
        : opportunity.type === 'mentorship'
          ? 'Менторство'
          : 'Вакансия'

  const compensation = document.createElement('span')
  compensation.className = 'map-popup__salary'
  compensation.textContent = opportunity.compensation

  top.append(badge, compensation)

  const title = document.createElement('strong')
  title.className = 'map-popup__title'
  title.textContent = opportunity.title

  const meta = document.createElement('div')
  meta.className = 'map-popup__meta'

  const company = document.createElement('span')
  company.textContent = opportunity.company

  const location = document.createElement('span')
  location.textContent = opportunity.location

  const format = document.createElement('span')
  format.textContent = opportunity.workFormat

  meta.append(company, location, format)

  const detailsLink = document.createElement('a')
  detailsLink.href = `/opportunity/${opportunity.id}`
  detailsLink.className = 'map-popup__action'
  detailsLink.textContent = 'Открыть карточку'

  wrapper.append(top, title, meta, createOpportunityTags(opportunity.tags), detailsLink)
  return wrapper
}

export function MapBoard({ opportunities, total, isLoading, errorMessage, onRetry, onBoundsChange, jumpToRequest }: MapBoardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapMarkersRef = useRef<maplibregl.Marker[]>([])
  const hasAutoFittedRef = useRef(false)
  const boundsDebounceRef = useRef<number | null>(null)
  const lastJumpTokenRef = useRef<number | null>(null)
  const [activeCluster, setActiveCluster] = useState<OpportunityMarker | null>(null)

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
      if (group.opportunities.length > 1) {
        return {
          id: key,
          lngLat: group.lngLat,
          kind: 'cluster' as const,
          count: group.opportunities.length,
          opportunities: group.opportunities,
        }
      }

      const [singleItem] = group.opportunities

      return {
        id: `single-${singleItem.id}`,
        lngLat: group.lngLat,
        kind: singleItem.verified ? 'verified' : 'single',
        count: 1,
        opportunities: group.opportunities,
      }
    })
  }, [opportunities])

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
      mapMarkersRef.current.forEach((marker) => marker.remove())
      mapMarkersRef.current = []
      map.remove()
      mapRef.current = null
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
        markerElement.className = `map-marker map-marker--${marker.kind}`
        markerElement.dataset.kind = marker.kind
        markerElement.ariaLabel = 'Метка возможности на карте'

        const glow = document.createElement('span')
        glow.className = 'map-marker__glow'

        const pin = document.createElement('span')
        pin.className = 'map-marker__pin'

        const glyph = document.createElement('span')
        glyph.className = 'map-marker__glyph'
        glyph.textContent = marker.kind === 'verified' ? '✓' : '✦'

        pin.append(glyph)
        markerElement.append(glow, pin)

        if (marker.kind === 'cluster') {
          const badge = document.createElement('span')
          badge.className = 'map-marker__count'
          badge.textContent = String(marker.count)
          markerElement.append(badge)
        }

        markerElement.addEventListener('click', () => {
          map.flyTo({
            center: marker.lngLat,
            zoom: marker.kind === 'cluster' ? Math.min(map.getZoom() + 2, 11) : 10.8,
            speed: 0.9,
            curve: 1.35,
            essential: true,
          })
        })

        const popup = new maplibregl.Popup({
          offset: 24,
          closeButton: false,
          maxWidth: '320px',
        }).setDOMContent(
          createPopupContent(marker, (clusterMarker) => {
            setActiveCluster(clusterMarker)
            popup.remove()

            map.flyTo({
              center: clusterMarker.lngLat,
              zoom: Math.min(map.getZoom() + 1, 11),
              speed: 0.8,
              curve: 1.2,
              essential: true,
            })

            setTimeout(() => {
              const section = document.getElementById('map-point-results')
              section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 50)
          }),
        )

        return new maplibregl.Marker({
          element: markerElement,
          anchor: 'center',
          offset: [0, -33],
        })
          .setLngLat(marker.lngLat)
          .setPopup(popup)
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

  const displayedItems = activeCluster ? activeCluster.opportunities : opportunities.slice(0, 6)

  return (
    <section className="map-mode">
      <div className="map-results card">
        <h3>
          {activeCluster
            ? `Вакансии в точке: ${activeCluster.opportunities[0]?.location ?? 'локация'}`
            : `Найдено ${total} возможностей`}
        </h3>
        <p>
          {activeCluster
            ? `Показаны ${activeCluster.count} вакансий в одной точке на карте.`
            : 'Показываем актуальные данные из бэкенда. Нажмите на маркер, чтобы открыть карточку.'}
        </p>

        {isLoading ? <div className="state-card">Загружаем карту и подборку...</div> : null}
        {!isLoading && errorMessage ? (
          <div className="state-card state-card--error">
            <p>{errorMessage}</p>
            <button type="button" className="btn btn--ghost" onClick={onRetry}>
              Повторить
            </button>
          </div>
        ) : null}
        {!isLoading && !errorMessage && opportunities.length === 0 ? (
          <div className="state-card">По вашему запросу ничего не найдено.</div>
        ) : null}

        {!isLoading && !errorMessage && opportunities.length > 0 ? (
          <div className="map-results__list" id="map-point-results">
            {activeCluster ? (
              <button type="button" className="btn btn--ghost" onClick={() => setActiveCluster(null)}>
                Показать общий список
              </button>
            ) : null}
            {displayedItems.map((item) => (
              <article key={item.id} className="map-mini-card">
                <h4>{item.title}</h4>
                <div>{item.company}</div>
                <div>{item.compensation}</div>
                <div>{item.location}</div>
                <div className="tag-row">
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link to={`/opportunity/${item.id}`} className="btn btn--ghost">
                  Открыть
                </Link>
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
