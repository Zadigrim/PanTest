'use server'

// Moichido merchant terminal — server actions.
//
// These call the M3 SECURITY DEFINER functions DIRECTLY via
// supabase.rpc(), server-side. This is deliberate: the M4.3 API
// host-gate makes /api/m3/* (and any non-/api/moichido/* route)
// unreachable from the moichido host, so the terminal cannot fetch
// those routes. A server action is a server-side DB call, not an
// HTTP request through middleware, so the gate doesn't apply.
//
// Auth is enforced by the functions themselves (they self-authorize
// via auth.uid()): ensure_moichido_punch_stop + issue_stop_qr_token
// require can_verify / can_distribute_prizes; redeem_completion
// requires can_distribute_prizes for the 'distributed' action. The
// UI also gates the panels, but the functions are the real gate.

import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import type { IssueResult, RedeemResult } from './types'

// Map a Postgres RPC error to an honest, operator-readable message.
// The M3 functions raise 42501 (auth), P0002 (not found), 22023
// (state/input).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpcMessage(error: any, fallback: string): string {
  return (error?.message as string) || fallback
}

/**
 * Issue a one-off punch QR for a card. Ensures the card's canonical
 * punch stop exists (ensure_moichido_punch_stop), then mints a
 * single-use, TTL-bounded token (issue_stop_qr_token) and renders it
 * as a QR the customer scans. The QR encodes the raw token string —
 * the same value consume_stop_qr_token_and_punch reads.
 */
export async function issuePunch(
  cardId: string,
  ttlSeconds = 300,
): Promise<IssueResult> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { ok: false, error: 'Not signed in.' }

  if (!cardId) return { ok: false, error: 'No card selected.' }
  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 && ttlSeconds <= 86400
    ? Math.floor(ttlSeconds)
    : 300

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // 1. Find-or-create the card's punch stop (additive function 029).
  const { data: stopId, error: stopErr } = await db.rpc('ensure_moichido_punch_stop', {
    p_passport_id: cardId,
  })
  if (stopErr || !stopId) {
    return { ok: false, error: rpcMessage(stopErr, 'Could not prepare this card for punching.') }
  }

  // 2. Issue the one-off token against that stop (M3 single source).
  const { data: token, error: issueErr } = await db.rpc('issue_stop_qr_token', {
    p_stop_id: stopId,
    p_ttl_seconds: ttl,
  })
  if (issueErr || !token) {
    return { ok: false, error: rpcMessage(issueErr, 'Could not issue a punch token.') }
  }

  // 3. Render the token as a QR for the customer to scan. The token
  // string is the payload consume_stop_qr_token_and_punch expects.
  let qrDataUrl: string
  try {
    qrDataUrl = await QRCode.toDataURL(token as string, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    })
  } catch {
    return { ok: false, error: 'Token issued but the QR could not be rendered.' }
  }

  return {
    ok: true,
    token: token as string,
    qrDataUrl,
    expiresAtMs: Date.now() + ttl * 1000,
  }
}

/**
 * Redeem a completed card and distribute the prize. Thin server-side
 * call to redeem_completion with action='distributed' — the SAME
 * single redemption + audit mechanism okuji uses (/api/token/redeem).
 * The function requires can_distribute_prizes, marks the completion
 * token distributed + logged, and (for reissue_on_completion cards)
 * issues the holder's next card instance.
 */
export async function redeemPunchCard(
  tokenCode: string,
  note?: string,
  extraGiftCardCents?: number,
): Promise<RedeemResult> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { ok: false, error: 'Not signed in.' }

  const code = (tokenCode ?? '').trim().toUpperCase()
  if (!code) return { ok: false, error: 'Enter a completion code.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('redeem_completion', {
    p_token_code: code,
    p_action: 'distributed',
    p_note: note && note.trim() ? note.trim() : null,
    p_extra_cents: typeof extraGiftCardCents === 'number' && extraGiftCardCents > 0
      ? Math.floor(extraGiftCardCents)
      : null,
  })

  if (error) {
    const msg = rpcMessage(error, 'Redemption failed.')
    // Friendlier phrasing for the common terminal cases.
    if (error.code === 'P0002') return { ok: false, error: 'No card found for that code.' }
    if (error.code === '22023' && /already redeemed/i.test(msg)) {
      return { ok: false, error: 'That card was already redeemed.' }
    }
    if (error.code === '42501') return { ok: false, error: 'You do not have permission to distribute prizes.' }
    return { ok: false, error: msg }
  }

  return { ok: true }
}
