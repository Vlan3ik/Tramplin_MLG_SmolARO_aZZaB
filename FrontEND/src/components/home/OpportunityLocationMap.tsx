import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cartoStyle } from './mapStyle'

type OpportunityLocationMapProps = {
  latitude: number | null | undefined
  longitude: number | null | undefined
  title: string
}

export function OpportunityLocationMap({ latitude, longitude, title }: OpportunityLocationMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current || latitude == null || longitude == null) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: cartoStyle,
      center: [longitude, latitude],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    const markerNode = document.createElement('div')
    markerNode.className = 'opportunity-location-marker'
    markerNode.innerHTML = '<span>•</span>'

    const marker = new maplibregl.Marker({ element: markerNode, anchor: 'bottom' })
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 18 }).setText(title))
      .addTo(map)

    markerRef.current = marker
    mapRef.current = map

    return () => {
      marker.remove()
      map.remove()
      markerRef.current = null
      mapRef.current = null
    }
  }, [latitude, longitude, title])

  if (latitude == null || longitude == null) {
    return (
      <div className="location-map location-map--empty">
        <p>Для этой вакансии координаты не указаны.</p>
      </div>
    )
  }

  return (
    <div className="location-map" role="img" aria-label={`Карта вакансии: ${title}`}>
      <div ref={containerRef} className="location-map__inner" />
    </div>
  )
}
