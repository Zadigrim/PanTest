// Server-side place resolution. Used by the seeder (and any future
// server route that needs to turn a name into address + coordinates).
//
// Hits the Geocoding API directly via HTTPS — no SDK, no native deps.
// Reuses the same ResolvedPlace shape the browser Places client
// returns, via the shared parser.
//
// Env var: GOOGLE_MAPS_SERVER_KEY. Separate from the browser key
// (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) because browser keys are usually
// HTTP-referrer-restricted and won't authorise server-side calls.
// The server key should be IP-restricted (or unrestricted with
// Geocoding API as the only enabled service).
//
// Graceful degradation: if the env var is unset, geocodeAvailable()
// returns false. Callers (the seeder) check it and skip resolution
// without failing.

import { parseGooglePlace } from './parse'
import type { ResolvedPlace } from './types'

const GEOCODE_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json'

function getKey(): string {
  return process.env.GOOGLE_MAPS_SERVER_KEY ?? ''
}

export function geocodeAvailable(): boolean {
  return getKey().length > 0
}

/** Resolve a free-form place query ("Bainbridge Island Museum of Art,
 *  Bainbridge Island, WA") to a ResolvedPlace. Returns null when:
 *   • no server key is set (caller should have checked geocodeAvailable
 *     first; this is a defensive second check)
 *   • the API returns ZERO_RESULTS / OVER_QUERY_LIMIT / a malformed payload
 *   • the result has no geometry
 *
 *  Logs a single line on each non-OK status so the seeder shows
 *  exactly which entries couldn't be resolved.
 */
export async function geocode(query: string): Promise<ResolvedPlace | null> {
  const key = getKey()
  if (!key) return null
  const url =
    `${GEOCODE_ENDPOINT}?address=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`

  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    console.warn(`[geocode] network error for "${query}":`,
      err instanceof Error ? err.message : String(err))
    return null
  }
  if (!res.ok) {
    console.warn(`[geocode] HTTP ${res.status} for "${query}"`)
    return null
  }

  let payload: {
    status: string
    error_message?: string
    results?: Parameters<typeof parseGooglePlace>[0][]
  }
  try {
    payload = await res.json()
  } catch {
    console.warn(`[geocode] non-JSON response for "${query}"`)
    return null
  }

  if (payload.status !== 'OK') {
    // ZERO_RESULTS is the most common — surface it clearly so the seed
    // log shows which template entries didn't resolve.
    console.warn(
      `[geocode] ${payload.status} for "${query}"` +
      (payload.error_message ? `: ${payload.error_message}` : ''),
    )
    return null
  }

  // Geocoding returns an array sorted by relevance; the first hit is
  // Google's best guess. Ambiguous queries log a hint.
  const results = payload.results ?? []
  if (results.length > 1) {
    console.warn(
      `[geocode] "${query}" was ambiguous (${results.length} candidates); ` +
      `taking the top match. Refine the query if it picked the wrong one.`,
    )
  }
  if (results.length === 0) return null
  return parseGooglePlace(results[0])
}
