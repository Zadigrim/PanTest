// POST /api/maps/reverse-geocode — turns a picked map coordinate into an
// address, SERVER-SIDE via the Geocoding API (lib/maps/server-geocode), so
// the browser never sees GOOGLE_MAPS_SERVER_KEY and no client Places SKU is
// billed. Called by the kobo map picker (MapPickerDialog) on confirm.
//
// Cost / abuse control:
//   • Auth-gated — only a signed-in user can reach it, so the server
//     Geocoding key can't be hammered anonymously.
//   • One call per pin confirm (the picker doesn't call per drag).
//
// Graceful: if the server key is unset or Google returns nothing, responds
// { place: null } and the picker keeps the coordinates, address stays manual.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reverseGeocode, geocodeAvailable } from '@/lib/maps/server-geocode'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // No server key configured → graceful no-op (picker keeps coords).
  if (!geocodeAvailable()) {
    return NextResponse.json({ place: null, reason: 'no_server_key' })
  }

  let body: { lat?: unknown; lng?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { lat, lng } = body
  if (
    typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }

  const place = await reverseGeocode(lat, lng)
  return NextResponse.json({ place })
}
