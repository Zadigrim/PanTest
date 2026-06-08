import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'

/**
 * PATCH /api/passport_pages/reorder
 *
 * Reassigns page_order on a set of pages in one shot, using a
 * two-phase write that respects the IMMEDIATE UNIQUE(passport_id,
 * page_order) constraint:
 *
 *   Phase 1: shove every active page's page_order to a unique
 *            NEGATIVE value (current_order → -(current_order+1)).
 *            Negatives don't collide with each other or with the
 *            incoming positive targets, so the index namespace is
 *            free.
 *   Phase 2: assign each ordered_ids[i] → page_order = i.
 *
 * Per-row UPDATEs without phase 1 deadlock the unique index on
 * any swap (e.g. A:0↔B:1 → first UPDATE collides). The phase-1
 * negation is the cheapest workaround that doesn't require a
 * DEFERRABLE migration or a Postgres function.
 *
 * Body: { passport_id: string, ordered_ids: string[] }
 *   ordered_ids MUST be the full list of active (non-closed)
 *   pages for the passport, in their desired order. The route
 *   verifies cardinality + membership before any write.
 *
 * Closed pages (closed_at IS NOT NULL) keep their stale
 * page_order — they sit outside the active-namespace and the
 * snapshot diff relies on those values.
 *
 * Auth: creator / admin / can_design at proprietor — same as
 * the other passport-mutation routes.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (
    !body
    || typeof body.passport_id !== 'string'
    || !Array.isArray(body.ordered_ids)
    || body.ordered_ids.some((v: unknown) => typeof v !== 'string')
  ) {
    return NextResponse.json(
      { error: 'passport_id (string) and ordered_ids (string[]) are required' },
      { status: 400 },
    )
  }
  const passportId: string = body.passport_id
  const orderedIds: string[] = body.ordered_ids

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, proprietor_id')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  const auth = await authorizePassportMutation(supabase, passport, user.id)
  if (auth === 'denied') {
    return NextResponse.json(
      { error: passport.proprietor_id
          ? 'Not authorized (creator, admin, or can_design at the owning institution required)'
          : 'Not the creator' },
      { status: 403 },
    )
  }

  // Cardinality + membership: ordered_ids must equal the full set
  // of active pages for this passport. A mismatch means the client
  // is stale (a page was added/deleted concurrently); refuse rather
  // than partially apply.
  const { data: active } = await db
    .from('passport_pages')
    .select('id, page_order')
    .eq('passport_id', passportId)
    .is('closed_at', null)
  const activeRows = (active ?? []) as { id: string; page_order: number }[]
  if (activeRows.length !== orderedIds.length) {
    return NextResponse.json(
      { error: `Page count mismatch (server has ${activeRows.length}, client sent ${orderedIds.length}). Refresh and retry.` },
      { status: 409 },
    )
  }
  const activeIdSet = new Set(activeRows.map((r) => r.id))
  for (const id of orderedIds) {
    if (!activeIdSet.has(id)) {
      return NextResponse.json(
        { error: `Page ${id} is not an active page of this passport. Refresh and retry.` },
        { status: 409 },
      )
    }
  }

  // Phase 1: negate every active page's order so the positive
  // namespace is empty for phase 2. Use -(page_order + 1) so the
  // mapping is injective (no two rows land on the same negative)
  // and never lands on 0 (which is a valid future positive).
  for (const row of activeRows) {
    const negated = -(row.page_order + 1)
    const { error: negErr } = await db
      .from('passport_pages')
      .update({ page_order: negated })
      .eq('id', row.id)
    if (negErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json(
        { error: `Reorder phase 1 failed: ${(negErr as any).message ?? 'unknown'}` },
        { status: 500 },
      )
    }
  }

  // Phase 2: assign final positive orders.
  for (let i = 0; i < orderedIds.length; i++) {
    const { error: posErr } = await db
      .from('passport_pages')
      .update({ page_order: i })
      .eq('id', orderedIds[i])
    if (posErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json(
        { error: `Reorder phase 2 failed: ${(posErr as any).message ?? 'unknown'}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, count: orderedIds.length })
}
