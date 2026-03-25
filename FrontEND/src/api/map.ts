import { getJson } from './client'

export type ReverseGeocodeResult = {
  requestedLatitude: number
  requestedLongitude: number
  latitude: number
  longitude: number
  countryCode: string | null
  regionName: string | null
  cityName: string | null
  streetName: string | null
  houseNumber: string | null
}

export async function reverseGeocode(latitude: number, longitude: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  })

  return getJson<ReverseGeocodeResult>(`/map/reverse-geocode?${params.toString()}`, { signal })
}
