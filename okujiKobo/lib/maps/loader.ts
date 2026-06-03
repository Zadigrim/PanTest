'use client'

// Single Google Maps JavaScript loader shared by every browser surface
// that needs Maps: the existing map picker AND the new place-search
// Autocomplete. Loads with libraries=places so PlacesService and
// AutocompleteService resolve. Graceful degradation: if the key isn't
// set, MAPS_API_AVAILABLE is false, callers render nothing, no script
// tag is appended, no console errors.

// Public env var — exposed to the browser bundle. Empty string when unset.
export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
export const MAPS_API_AVAILABLE = MAPS_API_KEY.length > 0

// Back-compat: the original map picker used MAPS_PICKER_AVAILABLE.
// Keep the alias so existing imports don't break.
export const MAPS_PICKER_AVAILABLE = MAPS_API_AVAILABLE

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mapsLoader: Promise<any> | null = null

/** Loads the Maps JS API once. Returns the google.maps namespace. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadGoogleMaps(): Promise<any> {
  if (!MAPS_API_AVAILABLE) {
    return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY unset'))
  }
  if (mapsLoader) return mapsLoader

  mapsLoader = new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as unknown as { google?: { maps: any } }
    if (w.google?.maps) {
      resolve(w.google.maps)
      return
    }
    const script = document.createElement('script')
    script.src =
      'https://maps.googleapis.com/maps/api/js' +
      `?key=${encodeURIComponent(MAPS_API_KEY)}&v=weekly&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (w.google?.maps) resolve(w.google.maps)
      else reject(new Error('google.maps unavailable after script load'))
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return mapsLoader
}
