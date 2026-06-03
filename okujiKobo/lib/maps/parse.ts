// Pure parser: Google address_components → our flat ResolvedPlace shape.
// Used by both the browser Place Details response (Places API) and the
// server Geocoding response, so there's one source of truth for how
// Google's component types map onto our stop schema.
//
// Component types reference:
//   https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Types

import type { ResolvedPlace } from './types'

interface AddressComponent {
  long_name:  string
  short_name: string
  types:      string[]
}

interface GooglePlaceLike {
  formatted_address?: string | null
  address_components?: AddressComponent[] | null
  name?: string | null
  place_id?: string | null
  geometry?: { location?: { lat: number; lng: number } | { lat: () => number; lng: () => number } } | null
}

function pick(components: AddressComponent[] | null | undefined, type: string, short = false): string | null {
  if (!components) return null
  const c = components.find((co) => co.types.includes(type))
  if (!c) return null
  return short ? c.short_name : c.long_name
}

/** Returns null if the source has no usable coordinates. */
export function parseGooglePlace(src: GooglePlaceLike): ResolvedPlace | null {
  const loc = src.geometry?.location
  if (!loc) return null

  // Browser Places API returns lat/lng as functions; REST Geocoding
  // returns them as plain numbers. Normalize.
  const lat = typeof (loc as { lat: () => number }).lat === 'function'
    ? (loc as { lat: () => number }).lat()
    : (loc as { lat: number }).lat
  const lng = typeof (loc as { lng: () => number }).lng === 'function'
    ? (loc as { lng: () => number }).lng()
    : (loc as { lng: number }).lng
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const comps = src.address_components ?? []
  const streetNumber = pick(comps, 'street_number')
  const route        = pick(comps, 'route')
  const street       = [streetNumber, route].filter(Boolean).join(' ') || null

  // City — Google's "locality" usually but smaller places fall back to
  // postal_town / sublocality / neighborhood. Pick the first that exists.
  const city =
    pick(comps, 'locality') ??
    pick(comps, 'postal_town') ??
    pick(comps, 'sublocality') ??
    pick(comps, 'sublocality_level_1') ??
    pick(comps, 'neighborhood') ??
    null

  // State / admin area. Short name ('WA') is what creators expect.
  const state = pick(comps, 'administrative_area_level_1', true)

  const zip = pick(comps, 'postal_code')

  // Country — long name ('United States') reads better than short ('US')
  // in the stop's address line and matches the existing seeded default.
  const country = pick(comps, 'country') ?? null

  return {
    formatted_address: src.formatted_address ?? null,
    name:              src.name ?? null,
    place_id:          src.place_id ?? null,
    street,
    city,
    state,
    zip,
    country,
    lat,
    lng,
  }
}
