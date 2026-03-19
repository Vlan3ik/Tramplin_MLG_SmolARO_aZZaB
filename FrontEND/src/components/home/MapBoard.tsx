import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Link } from 'react-router-dom'
import { opportunities } from '../../data/mockData'

type MarkerKind = 'single' | 'cluster' | 'favorite'

type OpportunityMarker = {
  id: number
  lngLat: [number, number]
  kind: MarkerKind
  count?: number
}

const markers: OpportunityMarker[] = [
  { id: 1, lngLat: [37.6176, 55.7558], kind: 'single' },
  { id: 2, lngLat: [30.3351, 59.9343], kind: 'cluster', count: 4 },
  { id: 3, lngLat: [39.7287, 47.2221], kind: 'favorite' },
  { id: 4, lngLat: [49.1221, 55.7887], kind: 'single' },
  { id: 5, lngLat: [60.6057, 56.8389], kind: 'cluster', count: 7 },
]

const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    esriSatellite: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
      maxzoom: 19,
    },
    esriLabels: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'satellite-base', type: 'raster', source: 'esriSatellite' },
    { id: 'satellite-labels', type: 'raster', source: 'esriLabels' },
  ],
}

function createPopupContent(opportunityId: number) {
  const opportunity = opportunities.find((item) => item.id === opportunityId)
  if (!opportunity) {
    return document.createTextNode('')
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'map-popup'

  const title = document.createElement('strong')
  title.textContent = opportunity.title

  const company = document.createElement('span')
  company.textContent = opportunity.company

  const compensation = document.createElement('span')
  compensation.textContent = opportunity.compensation

  const detailsLink = document.createElement('a')
  detailsLink.href = `/opportunity/${opportunity.id}`
  detailsLink.className = 'map-popup__link'
  detailsLink.textContent = 'Открыть карточку'

  wrapper.append(title, company, compensation, detailsLink)
  return wrapper
}

export function MapBoard() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  const markerData = useMemo(
    () =>
      markers.filter((marker) =>
        opportunities.some((opportunity) => opportunity.id === marker.id),
      ),
    [],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: satelliteStyle,
      center: [44.5, 56.2],
      zoom: 4.5,
      pitch: 52,
      bearing: -20,
      maxZoom: 18,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
    })

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right',
    )
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    const mapMarkers = markerData.map((marker) => {
      const markerElement = document.createElement('button')
      markerElement.type = 'button'
      markerElement.className = `map-marker map-marker--${marker.kind}`
      markerElement.dataset.kind = marker.kind
      markerElement.ariaLabel = 'Метка вакансии на карте'

      const glow = document.createElement('span')
      glow.className = 'map-marker__glow'

      const pin = document.createElement('span')
      pin.className = 'map-marker__pin'

      const glyph = document.createElement('span')
      glyph.className = 'map-marker__glyph'
      glyph.textContent = marker.kind === 'favorite' ? '★' : '✦'

      pin.append(glyph)

      markerElement.append(glow, pin)

      if (marker.kind === 'cluster') {
        const badge = document.createElement('span')
        badge.className = 'map-marker__count'
        badge.textContent = String(marker.count ?? '')
        markerElement.append(badge)
      }

      markerElement.addEventListener('click', () => {
        map.flyTo({
          center: marker.lngLat,
          zoom: 10.8,
          speed: 0.9,
          curve: 1.35,
          essential: true,
        })
      })

      const popup = new maplibregl.Popup({
        offset: 24,
        closeButton: false,
        maxWidth: '280px',
      }).setDOMContent(createPopupContent(marker.id))

      return new maplibregl.Marker({
        element: markerElement,
        anchor: 'bottom',
      })
        .setLngLat(marker.lngLat)
        .setPopup(popup)
        .addTo(map)
    })

    map.once('style.load', () => {
      const bounds = markerData.reduce(
        (acc, marker) => acc.extend(marker.lngLat),
        new maplibregl.LngLatBounds(markerData[0].lngLat, markerData[0].lngLat),
      )

      map.fitBounds(bounds, {
        padding: { top: 140, right: 80, bottom: 90, left: 420 },
        duration: 900,
        maxZoom: 8,
      })
    })

    mapRef.current = map

    return () => {
      mapMarkers.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [markerData])

  return (
    <section className="map-mode">
      <div className="map-results card">
        <h3>Найдено 248 возможностей</h3>
        <p>
          Маркеры вакансий выделены акцентным 3D-стилем: сияние, объемный пин и
          бейджи для кластеров.
        </p>

        <div className="map-results__list">
          {opportunities.slice(0, 4).map((item) => (
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
      </div>

      <div className="map-canvas card" role="img" aria-label="Карта возможностей">
        <div ref={mapContainerRef} className="map-canvas__inner" />
      </div>
    </section>
  )
}
