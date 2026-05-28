// Server-side provisioning of stop QR tokens.
//
// SECURITY MODEL:
//   - Tokens are generated server-side from crypto.getRandomValues (16 bytes
//     → 22 base64url characters, ~128 bits of entropy). Math.random was
//     previously used client-side, which is both predictable and forgeable.
//   - Validation happens in verify-stamp by comparing the scanned token
//     against the stored stops.qr_code_id value. This function only writes
//     the canonical value; clients never decide what the token is.
//   - Authentication is enforced via the shared JWT helper. The caller must
//     be the creator of the stop's passport (passports.creator_id), checked
//     explicitly here because the public-read RLS on stops is too permissive
//     to authorize a write by RLS alone.
//   - Error responses are generic ("Authentication required" / "Not
//     authorized" / "Failed to generate token"); detailed reasons are
//     console.error'd server-side only.
//
// Pre-existing tokens (Math.random "OKUJI-XXXXXXXX-YYYYYY") are invalidated
// by migration 006_reissue_stop_qr_tokens.sql.
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

function generateToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)
  const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `OKUJI-${b64url}`
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

    const { stopId, regenerate = false } = await req.json()
    if (!stopId) return json({ error: 'Not authorized' }, 403)

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ── Layer 2: authorize — caller must be creator of the stop's passport ──
    const { data: chain } = await supabase
      .from('stops')
      .select('id, qr_code_id, passport_pages!inner(passport_id, passports!inner(creator_id))')
      .eq('id', stopId)
      .maybeSingle()

    if (!chain) {
      console.error('provision-qr-token: stop not found or chain broken', { stopId })
      return json({ error: 'Not authorized' }, 403)
    }
    const creatorId = (chain as unknown as { passport_pages?: { passports?: { creator_id?: string } } })
      .passport_pages?.passports?.creator_id
    if (creatorId !== userId) {
      console.error('provision-qr-token: caller is not the creator', { userId, creatorId })
      return json({ error: 'Not authorized' }, 403)
    }

    // Default behavior: return the existing token. Requires explicit regenerate.
    if (chain.qr_code_id && !regenerate) {
      return json({ token: chain.qr_code_id, generated: false }, 200)
    }

    // Retry on the (astronomically rare) UNIQUE collision.
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = generateToken()
      const { error: updErr } = await supabase
        .from('stops')
        .update({ qr_code_id: token })
        .eq('id', stopId)
      if (!updErr) {
        return json({ token, generated: true }, 200)
      }
    }
    console.error('provision-qr-token: update failed after retries', { stopId })
    return json({ error: 'Failed to generate token' }, 500)
  } catch (err) {
    console.error('provision-qr-token: internal error', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
