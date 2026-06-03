'use client'

// Browser-side Places client. Wraps Google's AutocompleteService +
// PlacesService with the conventions we need everywhere:
//
//   • Session tokens — Google bills Autocomplete + Place Details as
//     ONE session-priced request when the same token covers both. Per
//     Google's docs the per-keystroke calls are then free; only the
//     final Place Details charge counts. We mint a new token per
//     "search-and-select" flow.
//
//   • Debounce is enforced at the COMPONENT level (PlaceSearch.tsx),
//     not here — keeping the API surface a pure async call so other
//     callers (a future bulk import, e.g.) can compose their own
//     debounce / throttle.
//
//   • Pure ResolvedPlace output — the consumer never touches Google's
//     SDK types.

import { loadGoogleMaps, MAPS_API_AVAILABLE } from './loader'
import { parseGooglePlace } from './parse'
import type { ResolvedPlace } from './types'

export interface PlacePrediction {
  description:  string
  place_id:     string
  main_text:    string
  secondary_text: string
}

export function placesAvailable(): boolean {
  return MAPS_API_AVAILABLE
}

/** Opaque session token for one search-and-select cycle. Create at
 *  search start, pass to every predictions call, pass once more to
 *  getPlaceDetails. After details, generate a fresh token for the
 *  next search. Treat as a single value — never log or persist it. */
export interface AutocompleteSessionToken {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _token: any
}

export async function createAutocompleteSession(): Promise<AutocompleteSessionToken> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maps: any = await loadGoogleMaps()
  return { _token: new maps.places.AutocompleteSessionToken() }
}

export async function getPlacePredictions(
  input: string,
  session: AutocompleteSessionToken,
): Promise<PlacePrediction[]> {
  if (!input || input.trim().length < 2) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maps: any = await loadGoogleMaps()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = new maps.places.AutocompleteService()

  return new Promise<PlacePrediction[]>((resolve) => {
    svc.getPlacePredictions(
      { input, sessionToken: session._token },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (results: any, status: string) => {
        // Empty / no-result statuses are not errors — render no items.
        if (status !== maps.places.PlacesServiceStatus.OK || !results) {
          resolve([])
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve(results.map((r: any) => ({
          description:    r.description,
          place_id:       r.place_id,
          main_text:      r.structured_formatting?.main_text ?? r.description,
          secondary_text: r.structured_formatting?.secondary_text ?? '',
        })))
      },
    )
  })
}

/** Fetches Place Details and returns our flat ResolvedPlace shape.
 *  Reuses the same session token as the predictions for billing
 *  attribution. Returns null when the place has no geometry. */
export async function getPlaceDetails(
  placeId: string,
  session: AutocompleteSessionToken,
): Promise<ResolvedPlace | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maps: any = await loadGoogleMaps()
  // PlacesService needs a DOM element to attach to; a detached div is fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = new maps.places.PlacesService(document.createElement('div'))

  return new Promise<ResolvedPlace | null>((resolve) => {
    svc.getDetails(
      {
        placeId,
        sessionToken: session._token,
        // Restrict fields so we only pay for what we use.
        fields: ['name', 'formatted_address', 'address_components', 'geometry', 'place_id'],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, status: string) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !result) {
          resolve(null)
          return
        }
        resolve(parseGooglePlace(result))
      },
    )
  })
}
