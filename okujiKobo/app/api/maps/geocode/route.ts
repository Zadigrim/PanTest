// POST /api/maps/geocode — forward geocoding for the map picker's search box.
// Turns a free-form query ("Port Orchard Marina, WA") into coordinates +
// address, SERVER-SIDE via the Geocoding API (lib/maps/server-geocode), so the
// browser never sees GOOGLE_MAPS_SERVER_KEY and no client Places Autocomplete
// SKU is billed. The sibling of reverse-geocode (coords→address); this is
// address→coords, called by MapPickerDialog when the designer searches.
//
// Cost / abuse control:
//   • Auth-gated — only a signed-in user can reach it.
//   • One call per explicit search submit (not per keystroke).
//   • Query length capped.
//
// Graceful: if the server key is unset or Google returns nothing, responds
// { place: null } and the picker leaves the map where it is.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geocode, geocodeAvailable } from '@/lib/maps/server-geocode'

const MAX_QUERY_LEN = 200

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // No server key configured → graceful no-op (picker keeps its view).
  if (!geocodeAvailable()) {
    return NextResponse.json({ place: null, reason: 'no_server_key' })
  }

  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 })
  }
  if (query.length > MAX_QUERY_LEN) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 })
  }

  const place = await geocode(query)
  return NextResponse.json({ place: place ?? null })
}
