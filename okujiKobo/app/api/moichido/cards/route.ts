import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/moichido/cards — create a new moichido punch card.
 *
 * Pilot scope (M4.3): the merchant clicks "New card" on the moichido
 * home; this route INSERTs a passports row + one passport_pages row
 * with the consumable discriminators AUTO-SET. The merchant never
 * sees the underlying credential_type / distribution_only toggles —
 * they're implied by designing in the moichido designer.
 *
 * Discriminator defaults written here:
 *   credential_type        = 'consumable'   (M3 punch model)
 *   distribution_only      = true           (leak guard — never on
 *                                            okuji Explore, even with
 *                                            is_published=true)
 *   is_published           = true           (cards are 'ready' on save;
 *                                            no publish ceremony)
 *   consumable_target_count= 10             (10-punch default; merchant
 *                                            can edit in the designer)
 *   proprietor_id          = merchant institution
 *   creator_id             = caller
 *   title                  = 'Untitled card'
 *
 * Auth: the caller must have an employee_authorizations row at an
 * institution with institution_type='moichido_merchant'. Pilot
 * provisioning is admin-only; this route does not create merchant
 * accounts.
 *
 * Host gate: middleware ensures this is reachable only from the
 * moichido host. A passport-surface call from okuji.app would 404
 * at the middleware before reaching this handler.
 *
 * Response: { id } — the new card id. The merchant home redirects
 * to /moichido/cards/[id]/edit.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Resolve merchant institution. Pilot: pick the first
  // moichido_merchant institution the user is attached to.
  const { data: authzRows } = await db
    .from('employee_authorizations')
    .select('institution_id, institutions!inner(id, institution_type, moichido_card_limit, status)')
    .eq('user_id', user.id)
    .eq('institutions.institution_type', 'moichido_merchant')

  const firstMerchant = ((authzRows ?? []) as Array<{
    institutions: { id: string; institution_type: string; moichido_card_limit: number | null; status: string | null }
  }>)[0]?.institutions

  if (!firstMerchant) {
    return NextResponse.json(
      { error: 'No moichido merchant account associated with this user.' },
      { status: 403 },
    )
  }

  // Suspended merchants can't mint new cards.
  if (firstMerchant.status === 'suspended') {
    return NextResponse.json(
      { error: 'This merchant account is suspended.' },
      { status: 403 },
    )
  }

  // Per-merchant card limit (migration 099). Null = unlimited. Count this
  // merchant's existing consumable cards; block at the limit.
  if (firstMerchant.moichido_card_limit != null) {
    const { count } = await db
      .from('passports')
      .select('id', { count: 'exact', head: true })
      .eq('proprietor_id', firstMerchant.id)
      .eq('credential_type', 'consumable')
    if ((count ?? 0) >= firstMerchant.moichido_card_limit) {
      return NextResponse.json(
        { error: `Card limit reached (${firstMerchant.moichido_card_limit}). Contact your moichido admin to raise it.` },
        { status: 409 },
      )
    }
  }

  // Insert the passport (the card). All discriminators set here so
  // the merchant never has to think about them — designing in the
  // moichido shell implies consumable + distribution-only.
  const { data: passport, error: pErr } = await db
    .from('passports')
    .insert({
      title:                   'Untitled card',
      creator_id:              user.id,
      proprietor_id:           firstMerchant.id,
      credential_type:         'consumable',
      distribution_only:       true,
      consumable_target_count: 10,
      is_published:            true,
      is_free:                 true,
      price_cents:             0,
    })
    .select('id')
    .single()

  if (pErr || !passport) {
    console.error('[POST /api/moichido/cards] passport insert failed:', pErr)
    return NextResponse.json({ error: pErr?.message ?? 'Card create failed' }, { status: 500 })
  }

  // One implicit page. Merchants can add info pages (terms, about)
  // via the designer's existing Pages section — multi-page is
  // permitted per the M4.3 spec, but a single stamp page is the
  // default starting point. page_type='stamp' so the canvas renders
  // the punch-location boxes.
  const { error: pageErr } = await db
    .from('passport_pages')
    .insert({
      passport_id:      passport.id,
      page_order:       0,
      section_name:     'Card',
      page_type:        'stamp',
      background_type:  'okuji',
      background_color: '0F4C5C',
      paper_color:      'FBF7F2',
    })

  if (pageErr) {
    console.error('[POST /api/moichido/cards] page insert failed:', pageErr)
    // Don't roll back the passport — it's recoverable from the
    // designer (the merchant just sees an empty page list and can
    // add one). Surface honestly.
  }

  return NextResponse.json({ id: passport.id }, { status: 201 })
}
