// Called when all stops on a page are stamped.
// Generates a single-use redemption token (format MCM-XXXX-XX).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateTokenCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part1 = Array.from(
    { length: 4 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  const part2 = Array.from(
    { length: 2 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `MCM-${part1}-${part2}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { pageId, userId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify all stops on this page are stamped by this user
    const { data: stops } = await supabase
      .from('stops')
      .select('id')
      .eq('page_id', pageId)

    if (!stops || stops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Page has no stops' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { data: stamps } = await supabase
      .from('stamps')
      .select('stop_id')
      .eq('user_id', userId)
      .in('stop_id', stops.map((s) => s.id))

    if (!stamps || stamps.length < stops.length) {
      return new Response(
        JSON.stringify({ error: 'Page not complete' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token already exists for this user+page
    const { data: existing } = await supabase
      .from('redemption_tokens')
      .select('id, token_code')
      .eq('user_id', userId)
      .eq('page_id', pageId)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify(existing),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const { data: page } = await supabase
      .from('passport_pages')
      .select('prize_redeemable_location_ids')
      .eq('id', pageId)
      .single()

    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    // Try inserting with generated token code; retry once on collision
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
        return new Response(
          JSON.stringify(token),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
