/**
 * Location caption formatting — CANONICAL source of truth.
 *
 * Mirrored at /lib/location-caption.ts for the mobile app (its tsconfig
 * excludes okujiKobo/). Keep the two byte-for-byte in sync — same
 * single-source rule as the stamp date-token. Pure functions, no
 * framework imports, so the kobo canvas, the print PDF, and the mobile
 * collector renderer all produce identical caption text.
 */

export type LocationCaptionMode = 'off' | 'address' | 'coordinates'
export type LocationCaptionPlacement = 'interior' | 'exterior'

export interface CaptionStopFields {
  lat: number | null
  lng: number | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  country: string | null
}

/**
 * "45.5762°N · 122.1158°W" — 4 decimals, hemisphere letters, unsigned.
 * Returns null when either coordinate is missing or NaN (honest blank;
 * never faked).
 */
export function formatCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (lat == null || lng == null) return null
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`
  return `${latStr} · ${lngStr}`
}

/**
 * Single-line address from the stop's address parts, e.g.
 * "123 Main St, Portland, OR 97201". Country appended only when set.
 * Returns null when nothing usable is present — the caller renders
 * nothing rather than an empty or faked line.
 */
export function composeAddressLine(
  s: Pick<CaptionStopFields, 'address_street' | 'address_city' | 'address_state' | 'address_zip' | 'country'>,
): string | null {
  const street = s.address_street?.trim() || ''
  const city = s.address_city?.trim() || ''
  const state = s.address_state?.trim() || ''
  const zip = s.address_zip?.trim() || ''
  const country = s.country?.trim() || ''
  const cityState = [city, state].filter(Boolean).join(', ')
  const cityStateZip = [cityState, zip].filter(Boolean).join(' ')
  const line = [street, cityStateZip, country].filter(Boolean).join(', ')
  return line || null
}

/**
 * The caption text for a stop given its mode — null when off or when the
 * chosen mode has no underlying data. Single source for all three
 * renderers; never returns a placeholder.
 */
export function locationCaptionText(
  mode: LocationCaptionMode | null | undefined,
  s: CaptionStopFields,
): string | null {
  if (mode === 'coordinates') return formatCoordinates(s.lat, s.lng)
  if (mode === 'address') return composeAddressLine(s)
  return null
}
