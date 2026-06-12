// Called when a collector attempts to stamp a stop.
// Verifies GPS radius AND/OR QR code match, then WRITES THE STAMP.
// Returns geohash — never stores precise coordinate.
//
// AUTH: requires a valid Supabase JWT. The caller must own the passport that
// contains the stop (via collector_passports). The userId is derived from the
// JWT, never from the request body. Error responses are generic; detailed
// reasons are logged server-side only.
//
// WRITE PATH (migration 026): this function is the ONLY stamp writer.
// Client INSERT on stamps is revoked by RLS, so verification cannot be
// skipped by a tampered client — the stamp row only exists if this
// function verified the visit (GPS/QR/honor) or confirmed the caller is
// an AUTHORIZED demo user (is_demo_authorized(): platform admin or a
// reviewer account's admin-set profiles.demo_mode_enabled).
//
// DEMO: body.demo === true requests the demo bypass. It is honored only
// after the database-side is_demo_authorized() check passes UNDER THE
// CALLER'S JWT; otherwise 403. Demo stamps are written with
// verification_method 'demo' and is_demo true — marked, excluded from
// verified-presence analytics, purgeable. They never masquerade as
// verified rows (enforced by the migration-026 trigger as well).
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

interface PlacementBody {
  posX?: number
  posY?: number
  contactSizePx?: number
  rotationDeg?: number
  saturation?: number
  smudgeDx?: number
  smudgeDy?: number
  smudgeIntensity?: number
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

    const {
      stopId, latitude, longitude, qrCodeId, stopOpenedAt,
      demo, placement, userId: bodyUserId,
    } = await req.json() as {
      stopId: string
      latitude?: number
      longitude?: number
      qrCodeId?: string
      stopOpenedAt?: string
      demo?: boolean
      placement?: PlacementBody
      userId?: string
    }

    // Body userId, if present, must match the JWT — never act on a different id.
    if (bodyUserId && bodyUserId !== userId) {
      console.error('verify-stamp: body userId does not match JWT user')
      return json({ error: 'Not authorized' }, 403)
    }

    // Service-role client for the actual reads/writes (RLS bypass); identity
    // is the verified userId above.
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

    // ── Demo bypass — server-authorized, never client-trusted ────────────────
    let isDemo = false
    if (demo === true) {
      // Evaluate is_demo_authorized() UNDER THE CALLER'S JWT so auth.uid()
      // resolves to the verified user. A demo request from anyone else is
      // rejected here — the bypass does not exist for them.
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      })
      const { data: authorized, error: authzErr } = await userClient.rpc('is_demo_authorized')
      if (authzErr || authorized !== true) {
        console.error('verify-stamp: unauthorized demo request', { userId, authzErr })
        return json({ error: 'Not authorized' }, 403)
      }
      isDemo = true
    }

    // ── Tier-based verification (skipped only for authorized demo) ───────────
    let geohash: string | null = null
    let verificationMethod = 'gps_only'

    if (isDemo) {
      verificationMethod = 'demo'
    } else {
      let gpsVerified = false
      let qrVerified = false

      const tier = stop.verification_tier ?? stop.evidence_tier ?? 5

      if (tier === 5) {
        // Honor system — no GPS or QR needed.
        verificationMethod = 'self_reported'
        if (latitude != null && longitude != null) {
          geohash = encodeGeohash(latitude, longitude, 6)
        }
      } else {
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
        geohash = encodeGeohash(latitude!, longitude!, 6)
      }
    }

    // ── Write the stamp (service role — the only INSERT path) ────────────────
    const { data: stamp, error: insertError } = await supabase
      .from('stamps')
      .insert({
        user_id: userId,
        stop_id: stopId,
        collector_passport_id: owned.id,
        geohash,
        stamp_pos_x: placement?.posX ?? null,
        stamp_pos_y: placement?.posY ?? null,
        contact_size_px: placement?.contactSizePx ?? null,
        rotation_deg: placement?.rotationDeg ?? 0,
        saturation: placement?.saturation ?? null,
        smudge_dx: placement?.smudgeDx ?? null,
        smudge_dy: placement?.smudgeDy ?? null,
        smudge_intensity: placement?.smudgeIntensity ?? null,
        verification_method: verificationMethod,
        is_demo: isDemo,
        stop_opened_at: stopOpenedAt ?? null,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      // UNIQUE(user_id, stop_id) — one stamp per collector per stop.
      if (insertError.code === '23505') {
        return json({ verified: false, reason: 'Already stamped' }, 409)
      }
      console.error('verify-stamp: stamp insert failed', insertError)
      return json({ error: 'Internal server error' }, 500)
    }

    return json({ verified: true, geohash, verificationMethod, stopOpenedAt, stamp }, 200)
  } catch (err) {
    console.error('verify-stamp: internal error', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
