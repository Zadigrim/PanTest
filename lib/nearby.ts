/**
 * Nearby-passport discovery client (mobile collector app).
 *
 * One call, one round-trip:
 *   1. ask for foreground permission (no-op if already granted)
 *   2. get a one-shot GPS reading with a short timeout
 *   3. invoke the find_passports_nearby() RPC
 *   4. DISCARD the coordinates from memory
 *
 * PRIVACY:
 * Coordinates enter via `loc.latitude / loc.longitude` and are
 * passed to .rpc() exactly once. They are NOT stored in component
 * state, NOT written to AsyncStorage, NOT sent to any analytics,
 * and NOT logged. After this function returns, no reference to the
 * coords remains in app memory.
 *
 * Server-side: the RPC itself is stateless (see migration 012).
 */

import * as Location from 'expo-location'
import { supabase } from './supabase'
import { requestLocationPermission } from './gps'

export type NearbyPermissionState =
  | 'unknown'        // first run; haven't asked
  | 'denied'         // user said no; show the enable-location card
  | 'granted'        // user said yes
  | 'unavailable'    // permission granted but the fix never arrived (timeout)

export interface NearbyPassport {
  passport_id: string
  title: string
  cover_emblem: string | null
  cover_bg_color: string | null
  cover_thumbnail: string | null
  is_free: boolean
  price_cents: number
  creator_id: string
  proprietor_id: string | null
  distance_m: number
  stops_in_radius: number
}

export interface FetchNearbyResult {
  state: NearbyPermissionState
  passports: NearbyPassport[]
  error: string | null
}

/**
 * Defaults match the spec: 25km, 20 results. Parameterized so the
 * UI never hardcodes the values — adjust here, not in the screen.
 */
const DEFAULT_RADIUS_KM = 25
const DEFAULT_LIMIT = 20

export async function fetchNearbyPassports(options?: {
  radiusKm?: number
  limit?: number
}): Promise<FetchNearbyResult> {
  // 1 — permission. requestLocationPermission re-uses the existing
  // helper that verify-stamp uses; it asks only when not already
  // answered.
  const hasPermission = await requestLocationPermission()
  if (!hasPermission) {
    return { state: 'denied', passports: [], error: null }
  }

  // 2 — GPS reading with a short, Nearby-specific timeout. We don't
  // share verify-stamp's getCurrentLocation() because verify-stamp
  // is intentionally permitted to wait as long as the platform
  // needs to lock on (the user is verifying right now). Discovery
  // is different: the user is staring at a button and a fast
  // "couldn't get a fix" is better than a hang.
  let loc: { latitude: number; longitude: number } | null = null
  try {
    const reading = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ])
    if (reading) {
      loc = { latitude: reading.coords.latitude, longitude: reading.coords.longitude }
    }
  } catch {
    loc = null
  }
  if (loc === null) {
    return { state: 'unavailable', passports: [], error: null }
  }

  // 3 — RPC. Coords go in as parameters; the function is STABLE
  // PARALLEL SAFE and writes nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('find_passports_nearby', {
    p_lat:       loc.latitude,
    p_lng:       loc.longitude,
    p_radius_km: options?.radiusKm ?? DEFAULT_RADIUS_KM,
    p_limit:     options?.limit    ?? DEFAULT_LIMIT,
  })

  // 4 — Coords are now out of scope. The `loc` reference dies with
  // this function frame; no caller receives it. (The Supabase
  // client may keep the request in a queue briefly; we don't log
  // it.) The Result we return contains zero coordinate fields.

  if (error) {
    return { state: 'granted', passports: [], error: error.message ?? 'Nearby query failed' }
  }
  return {
    state: 'granted',
    passports: (data ?? []) as NearbyPassport[],
    error: null,
  }
}
