import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RedeemBody {
  tokenCode: string
  action: 'distributed' | 'pending'
  note?: string
  extraGiftCardCents?: number
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  // Auth check — must be an authenticated employee
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
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

  // Find completion token
  const { data: token, error: tokenError } = await supabase
    .from('completion_tokens')
    .select('id, user_id, passport_id, page_id, redeemed_at')
    .eq('token_code', tokenCode)
    .single()

  if (tokenError || !token) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  if (token.redeemed_at !== null) {
    return NextResponse.json({ error: 'Token has already been redeemed' }, { status: 409 })
  }

  // Look up institution for the passport
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, proprietor_id')
    .eq('id', token.passport_id)
    .single()

  if (passportError || !passport || !passport.proprietor_id) {
    return NextResponse.json(
      { error: 'Passport or institution not found' },
      { status: 404 },
    )
  }

  // Verify employee authorization for this institution
  const { data: authorization, error: authzError } = await supabase
    .from('employee_authorizations')
    .select('id, can_verify, can_distribute_prizes, can_add_extras')
    .eq('user_id', user.id)
    .eq('institution_id', passport.proprietor_id)
    .eq('can_verify', true)
    .single()

  if (authzError || !authorization) {
    return NextResponse.json(
      { error: 'Not authorized to redeem tokens for this institution' },
      { status: 403 },
    )
  }

  const now = new Date().toISOString()

  if (action === 'distributed') {
    // Mark as fully distributed and redeemed
    const { error: updateError } = await supabase
      .from('completion_tokens')
      .update({
        prize_distributed: true,
        redeemed_at: now,
        redeemed_by: user.id,
        distribution_logged_at: now,
        distribution_logged_by: user.id,
        prize_note: buildPrizeNote(note, extraGiftCardCents),
      })
      .eq('id', token.id)

    if (updateError) {
      console.error('[token/redeem] distributed update error:', updateError)
      return NextResponse.json({ error: 'Failed to update token' }, { status: 500 })
    }
  } else {
    // action === 'pending'
    // This MUST create a record — it cannot be a no-op.
    // We explicitly set distribution_pending = true so the row is always mutated.
    const { error: updateError } = await supabase
      .from('completion_tokens')
      .update({
        distribution_pending: true,
        prize_note: buildPrizeNote(note, extraGiftCardCents),
      })
      .eq('id', token.id)

    if (updateError) {
      console.error('[token/redeem] pending update error:', updateError)
      return NextResponse.json({ error: 'Failed to mark token as pending' }, { status: 500 })
    }
  }

  // Extra gift card handling
  if (extraGiftCardCents !== undefined && extraGiftCardCents > 0) {
    if (!authorization.can_add_extras) {
      return NextResponse.json(
        { error: 'Not authorized to add gift card extras' },
        { status: 403 },
      )
    }
    // The extra amount is logged in prize_note (handled above via buildPrizeNote).
    // A separate ledger / gift-card issuance system would be triggered here.
    // TODO: integrate gift card issuance flow when available.
  }

  return NextResponse.json({ success: true })
}

function buildPrizeNote(note: string | undefined, extraGiftCardCents: number | undefined): string | null {
  const parts: string[] = []
  if (note) parts.push(note)
  if (extraGiftCardCents && extraGiftCardCents > 0) {
    parts.push(`Extra gift card: $${(extraGiftCardCents / 100).toFixed(2)}`)
  }
  return parts.length > 0 ? parts.join(' | ') : null
}
