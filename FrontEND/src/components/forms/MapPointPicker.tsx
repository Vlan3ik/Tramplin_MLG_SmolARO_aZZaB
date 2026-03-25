import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cartoStyle } from '../home/mapStyle'

export type MapPoint = {
  latitude: number
  longitude: number
}

type MapPointPickerProps = {
  value: MapPoint | null
  onChange: (value: MapPoint) => void
  defaultCenter?: [number, number]
  defaultZoom?: number
  className?: string
}

export function MapPointPicker({ value, onChange, defaultCenter, defaultZoom = 10, className }: MapPointPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const isApplyingExternalValueRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialCenter: [number, number] = value
      ? [value.longitude, value.latitude]
      : defaultCenter ?? [37.6156, 55.7522]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: cartoStyle,
      center: initialCenter,
      zoom: defaultZoom,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    if (value) {
      markerRef.current = new maplibregl.Marker({ anchor: 'bottom' })
        .setLngLat([value.longitude, value.latitude])
        .addTo(map)
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (isApplyingExternalValueRef.current) {
        return
      }

      const point = {
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      }

      if (markerRef.current) {
        markerRef.current.setLngLat([point.longitude, point.latitude])
      } else {
        markerRef.current = new maplibregl.Marker({ anchor: 'bottom' }).setLngLat([point.longitude, point.latitude]).addTo(map)
      }

      onChange(point)
    }

    map.on('click', handleMapClick)
    mapRef.current = map

    return () => {
      map.off('click', handleMapClick)
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [defaultCenter, defaultZoom, onChange, value])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    isApplyingExternalValueRef.current = true
    try {
      const lngLat: [number, number] = [value.longitude, value.latitude]

      if (markerRef.current) {
        markerRef.current.setLngLat(lngLat)
      } else {
        markerRef.current = new maplibregl.Marker({ anchor: 'bottom' }).setLngLat(lngLat).addTo(map)
      }

      map.easeTo({ center: lngLat, duration: 250 })
    } finally {
      isApplyingExternalValueRef.current = false
    }
  }, [value])

  return <div ref={containerRef} className={className ?? 'vf-map-picker'} />
}
