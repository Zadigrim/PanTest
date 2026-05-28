// Called when a collector attempts to stamp a stop.
// Verifies GPS radius AND/OR QR code match.
// Returns geohash — never stores precise coordinate.
//
// AUTH: requires a valid Supabase JWT. The caller must own the passport that
// contains the stop (via collector_passports). The userId is derived from the
// JWT, never from the request body. Error responses are generic; detailed
// reasons are logged server-side only.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractAndVerifyJWT } from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function encodeGeohash(lat: number, lng: number, precision = 6): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let minLat = -90, maxLat = 90
  let minLng = -180, maxLng = 180
  let hash = ''
  let bits = 0
  let hashValue = 0
  let isEven = true

  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2
      if (lng > mid) { hashValue = (hashValue << 1) | 1; minLng = mid }
      else { hashValue = hashValue << 1; maxLng = mid }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat > mid) { hashValue = (hashValue << 1) | 1; minLat = mid }
      else { hashValue = hashValue << 1; maxLat = mid }
    }
    isEven = !isEven
    bits++
    if (bits === 5) {
      hash += BASE32[hashValue]
      bits = 0
      hashValue = 0
    }
  }
  return hash
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  try {
    // ── Layer 1: authenticate ────────────────────────────────────────────────
    const auth = await extractAndVerifyJWT(req, supabaseUrl)
    if ('error' in auth) {
      return json({ error: 'Authentication required' }, 401)
    }
    const userId = auth.user.id

    const { stopId, latitude, longitude, qrCodeId, stopOpenedAt, userId: bodyUserId } = await req.json()

    // Body userId, if present, must match the JWT — never act on a different id.
    if (bodyUserId && bodyUserId !== userId) {
      console.error('verify-stamp: body userId does not match JWT user')
      return json({ error: 'Not authorized' }, 403)
    }

    // Service-role client for the actual reads (RLS bypass); identity is the
    // verified userId above.
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: stop, error: stopError } = await supabase
      .from('stops')
      .select('*')
      .eq('id', stopId)
      .single()

    if (stopError || !stop) {
      return json({ error: 'Stop not found' }, 404)
    }

    // ── Layer 2: authorize — caller must own the stop's passport ─────────────
    const { data: page } = await supabase
      .from('passport_pages')
      .select('passport_id')
      .eq('id', stop.page_id)
      .maybeSingle()

    if (!page) {
      console.error('verify-stamp: stop has no resolvable page/passport', { stopId })
      return json({ error: 'Not authorized' }, 403)
    }

    const { data: owned } = await supabase
      .from('collector_passports')
      .select('id')
      .eq('user_id', userId)
      .eq('passport_id', page.passport_id)
      .maybeSingle()

    if (!owned) {
      console.error('verify-stamp: caller does not own passport', { userId, passportId: page.passport_id })
      return json({ error: 'Not authorized' }, 403)
    }

    // ── Tier-based verification (unchanged) ──────────────────────────────────
    let gpsVerified = false
    let qrVerified = false
    let verificationMethod = 'gps_only'

    const tier = stop.verification_tier ?? stop.evidence_tier ?? 5

    // Honor system — no GPS or QR needed
    if (tier === 5) {
      return json({
        verified: true,
        geohash: encodeGeohash(latitude || 0, longitude || 0, 6),
        verificationMethod: 'self_reported',
        stopOpenedAt,
      }, 200)
    }

    // GPS verification via PostGIS
    if (latitude != null && longitude != null && stop.target_location) {
      const { data: gpsResult } = await supabase.rpc('check_gps_within_radius', {
        user_lat: latitude,
        user_lng: longitude,
        stop_id: stopId,
        radius_m: stop.verification_radius_meters ?? stop.radius_meters ?? 150,
      })
      gpsVerified = gpsResult === true
    }

    // QR verification
    if (qrCodeId && (stop.qr_code_token || stop.qr_code_id)) {
      qrVerified = qrCodeId === (stop.qr_code_token ?? stop.qr_code_id)
    }

    let verified = false
    switch (tier) {
      case 1:
      case 2:
        verified = gpsVerified && qrVerified
        verificationMethod = 'qr_gps'
        break
      case 3:
        verified = gpsVerified
        verificationMethod = 'gps_only'
        break
      case 4:
        // Employee verification — separate flow
        verified = false
        break
    }

    if (!verified) {
      return json({ verified: false, reason: 'Location not confirmed' }, 200)
    }

    // PRIVACY: geohash (~1.2km at precision 6) — discard precise coordinate
    const geohash = encodeGeohash(latitude, longitude, 6)
    return json({ verified: true, geohash, verificationMethod, stopOpenedAt }, 200)
  } catch (err) {
    console.error('verify-stamp: internal error', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
