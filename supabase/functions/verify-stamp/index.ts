// Called when a collector attempts to stamp a stop.
// Verifies GPS radius AND/OR QR code match.
// Returns geohash — never stores precise coordinate.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function encodeGeohash(lat: number, lng: number, precision = 6): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let minLat = -90, maxLat = 90
  let minLng = -180, maxLng = 180
  let hash = ''
  let bits = 0
  let bitsTotal = 0
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
    bitsTotal++
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

  try {
    const { stopId, latitude, longitude, qrCodeId, stopOpenedAt } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: stop, error: stopError } = await supabase
      .from('stops')
      .select('*')
      .eq('id', stopId)
      .single()

    if (stopError || !stop) {
      return new Response(
        JSON.stringify({ error: 'Stop not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    let gpsVerified = false
    let qrVerified = false
    let verificationMethod = 'gps_only'

    // GPS verification via PostGIS
    if (latitude != null && longitude != null && stop.target_location) {
      const { data: gpsResult } = await supabase.rpc('check_gps_within_radius', {
        user_lat: latitude,
        user_lng: longitude,
        stop_id: stopId,
        radius_m: stop.radius_meters,
      })
      gpsVerified = gpsResult === true
    }

    // QR verification
    if (qrCodeId && stop.qr_code_id) {
      qrVerified = qrCodeId === stop.qr_code_id
    }

    // Evidence tier logic
    let verified = false
    switch (stop.evidence_tier) {
      case 1:
        verified = gpsVerified && qrVerified
        verificationMethod = 'qr_gps'
        break
      case 2:
        verified = qrVerified && gpsVerified
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
      case 5:
        verified = true
        verificationMethod = 'self_reported'
        break
    }

    if (!verified) {
      return new Response(
        JSON.stringify({ verified: false, reason: 'Location not confirmed' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // PRIVACY: Generate geohash (~1.2km at precision 6) — discard precise coordinate
    const geohash = encodeGeohash(latitude, longitude, 6)

    return new Response(
      JSON.stringify({ verified: true, geohash, verificationMethod, stopOpenedAt }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
