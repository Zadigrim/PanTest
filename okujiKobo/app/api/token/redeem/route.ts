import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RedeemBody {
  tokenCode: string
  action: 'distributed' | 'pending'
  note?: string
  extraGiftCardCents?: number
}

/**
 * POST /api/token/redeem
 *
 * Thin wrapper around the redeem_completion SECURITY DEFINER
 * function (migration 021). The function is the unified redemption
 * surface for both persistent (McMenamins-style prizes) and
 * consumable (moichido card completion) credentials — KI-02
 * closure. For consumable holders whose card was filled by punch,
 * the function additionally issues the next sequence card_instance
 * when the holder's card was configured with reissue_on_completion.
 *
 * The function enforces: can_verify required for both actions,
 * can_distribute_prizes additionally required for action='distributed'
 * (closes the DEC-08 logic). The route no longer needs to redo
 * those checks — the function rejects with 42501 on failure and
 * the route maps that to HTTP 403.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RedeemBody
  try {
    body = (await request.json()) as RedeemBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tokenCode, action, note, extraGiftCardCents } = body
  if (!tokenCode) {
    return NextResponse.json({ error: 'tokenCode is required' }, { status: 400 })
  }
  if (action !== 'distributed' && action !== 'pending') {
    return NextResponse.json(
      { error: 'action must be "distributed" or "pending"' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (supabase as any).rpc('redeem_completion', {
    p_token_code: tokenCode,
    p_action: action,
    p_note: note ?? null,
    p_extra_cents: typeof extraGiftCardCents === 'number' ? extraGiftCardCents : null,
  })

  if (rpcErr) {
    // Function raises 42501 for auth, 22023 for state/input, P0002 for not-found.
    const status = rpcErr.code === '42501' ? 403
      : rpcErr.code === 'P0002' ? 404
      : rpcErr.code === '22023' ? (rpcErr.message?.includes('already redeemed') ? 409 : 400)
      : 500
    console.error('[token/redeem] rpc error:', rpcErr)
    return NextResponse.json({ error: rpcErr.message ?? 'Redemption failed' }, { status })
  }

  return NextResponse.json({ success: true })
}
