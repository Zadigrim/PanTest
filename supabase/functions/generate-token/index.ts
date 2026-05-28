// Called when all stops on a page are stamped.
// Generates a single-use redemption token (format MCM-XXXX-XX).
//
// AUTH: requires a valid Supabase JWT. The caller must own the passport that
// contains the page. The userId is derived from the JWT, never from the request
// body. Completeness and dedup checks are keyed to the JWT user. Error responses
// are generic; detailed reasons are logged server-side only.
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

function generateTokenCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const part2 = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `MCM-${part1}-${part2}`
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

    const { pageId, userId: bodyUserId } = await req.json()

    if (bodyUserId && bodyUserId !== userId) {
      console.error('generate-token: body userId does not match JWT user')
      return json({ error: 'Not authorized' }, 403)
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ── Layer 2: authorize — caller must own the page's passport ─────────────
    const { data: pageOwner } = await supabase
      .from('passport_pages')
      .select('passport_id')
      .eq('id', pageId)
      .maybeSingle()

    if (!pageOwner) {
      console.error('generate-token: page not found', { pageId })
      return json({ error: 'Not authorized' }, 403)
    }

    const { data: owned } = await supabase
      .from('collector_passports')
      .select('id')
      .eq('user_id', userId)
      .eq('passport_id', pageOwner.passport_id)
      .maybeSingle()

    if (!owned) {
      console.error('generate-token: caller does not own passport', { userId, passportId: pageOwner.passport_id })
      return json({ error: 'Not authorized' }, 403)
    }

    // ── Completeness + dedup (keyed to the JWT user; logic unchanged) ────────
    const { data: stops } = await supabase
      .from('stops')
      .select('id')
      .eq('page_id', pageId)

    if (!stops || stops.length === 0) {
      return json({ error: 'Page has no stops' }, 400)
    }

    const { data: stamps } = await supabase
      .from('stamps')
      .select('stop_id')
      .eq('user_id', userId)
      .in('stop_id', stops.map((s) => s.id))

    if (!stamps || stamps.length < stops.length) {
      return json({ error: 'Page not complete' }, 400)
    }

    const { data: existing } = await supabase
      .from('redemption_tokens')
      .select('id, token_code')
      .eq('user_id', userId)
      .eq('page_id', pageId)
      .maybeSingle()

    if (existing) {
      return json(existing, 200)
    }

    const { data: page } = await supabase
      .from('passport_pages')
      .select('prize_redeemable_location_ids')
      .eq('id', pageId)
      .single()

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    for (let attempt = 0; attempt < 2; attempt++) {
      const tokenCode = generateTokenCode()
      const { data: token, error } = await supabase
        .from('redemption_tokens')
        .insert({
          user_id: userId,
          page_id: pageId,
          token_code: tokenCode,
          location_whitelist: page?.prize_redeemable_location_ids ?? null,
          expires_at: expires.toISOString(),
        })
        .select()
        .single()

      if (!error && token) {
        return json(token, 200)
      }
    }

    return json({ error: 'Failed to generate token' }, 500)
  } catch (err) {
    console.error('generate-token: internal error', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
