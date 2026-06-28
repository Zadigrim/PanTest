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
  tiltDx?: number
  tiltDy?: number
  tiltIntensity?: number
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

    // Is the passport DEMO-published? Read server-side — the client can neither
    // fake this nor trigger it on a non-demo passport. is_demo is admin-only
    // (migration 105 guard), so its presence is trustworthy.
    const { data: passportRow } = await supabase
      .from('passports')
      .select('is_demo')
      .eq('id', page.passport_id)
      .maybeSingle()
    const passportIsDemo = passportRow?.is_demo === true

    // ── Demo determination — server-decided, never client-trusted ────────────
    // A stamp is a demo stamp if EITHER:
    //   • the passport is demo-published (any holder — keyed to the PASSPORT), or
    //   • the caller is an authorized demo user (legacy admin/reviewer path,
    //     body.demo, re-checked under the caller's JWT).
    let isDemo = false
    if (passportIsDemo) {
      isDemo = true
    } else if (demo === true) {
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

    // ── Tier-based verification ──────────────────────────────────────────────
    // ALWAYS run the check (even for demo) so the real GPS/QR result is RECORDED
    // in gps_verified. For a demo stamp the result never blocks — we allow and
    // record. For a non-demo stamp the result is enforced exactly as before.
    let geohash: string | null = null
    let gpsVerified: boolean | null = null
    let verificationMethod = 'gps_only'
    let verified = false

    const tier = stop.verification_tier ?? stop.evidence_tier ?? 5

    if (tier === 5) {
      // Honor system — no GPS or QR needed; nothing to verify against.
      verified = true
      verificationMethod = 'self_reported'
      if (latitude != null && longitude != null) {
        geohash = encodeGeohash(latitude, longitude, 6)
      }
    } else {
      let qrVerified = false

      // GPS verification via PostGIS — records the real within-radius result.
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

      switch (tier) {
        case 1:
        case 2:
          verified = gpsVerified === true && qrVerified
          verificationMethod = 'qr_gps'
          break
        case 3:
          verified = gpsVerified === true
          verificationMethod = 'gps_only'
          break
        case 4:
          // Employee verification — separate flow
          verified = false
          break
      }

      // PRIVACY: geohash (~1.2km at precision 6) — discard precise coordinate.
      // Recorded whenever a fix exists (incl. demo stamps placed off-site).
      if (latitude != null && longitude != null) {
        geohash = encodeGeohash(latitude, longitude, 6)
      }
    }

    // Demo: allow regardless, but the real result is preserved in gpsVerified.
    // Non-demo: enforce — an unverified attempt writes no stamp (unchanged).
    if (isDemo) {
      verificationMethod = 'demo'
    } else if (!verified) {
      return json({ verified: false, reason: 'Location not confirmed' }, 200)
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
        tilt_dx: placement?.tiltDx ?? null,
        tilt_dy: placement?.tiltDy ?? null,
        tilt_intensity: placement?.tiltIntensity ?? null,
        verification_method: verificationMethod,
        is_demo: isDemo,
        // The real proximity result, recorded even when a demo stamp is allowed
        // off-site — so demo stamps never read as verified yet honest "were they
        // actually there?" data survives (migration 031).
        gps_verified: gpsVerified,
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

    // Passport-completion prize: if this stamp completed the WHOLE passport
    // (all stops across all pages) AND the passport defines a completion prize,
    // mint the passport-scoped completion token. Idempotent + prize-gated in the
    // RPC. Server-side here (no mobile/AAB change) and the SAME redemption flow
    // as page tokens. Non-blocking — never fail the stamp over this.
    try {
      await supabase.rpc('generate_passport_completion_token', {
        p_user_id: userId,
        p_passport_id: page.passport_id,
      })
    } catch (completionErr) {
      console.error('verify-stamp: passport completion token generation failed', completionErr)
    }

    return json({ verified: true, geohash, verificationMethod, stopOpenedAt, stamp }, 200)
  } catch (err) {
    console.error('verify-stamp: internal error', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
