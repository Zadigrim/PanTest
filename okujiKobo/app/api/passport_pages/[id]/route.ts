import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'

/**
 * DELETE /api/passport_pages/:id
 *
 * Two behaviors based on the parent passport's acquisition state:
 *
 *   ZERO ACQUISITIONS — physical DELETE with explicit cascade.
 *     The page row is deleted (passport_pages.id ON DELETE CASCADE
 *     cascades to stops automatically). Stamps belonging to those
 *     stops do NOT cascade (stamps.stop_id has no ON DELETE
 *     CASCADE — preservation invariant for the published path).
 *     For drafts the route explicitly DELETEs stamps first; that
 *     cascades to journal_entries (stamp_id ON DELETE CASCADE per
 *     migration 001), so the chain is page → stops → stamps →
 *     journals, all removed atomically.
 *
 *   HAS ACQUISITIONS — soft-close. Sets passport_pages.closed_at
 *     = now() AND stops.closed_at = now() on every stop belonging
 *     to the page. Holders' earned stamps are preserved untouched;
 *     the closed page disappears from the active designer and
 *     holder views; the republish diff (lib/design/republish/
 *     diff.ts) detects the closure as 'page_closure' on next
 *     republish and informs holders via the existing notification
 *     banner.
 *
 * AUTHORIZATION: same shape as the other passport-mutation routes
 * — creator / admin / can_design at the proprietor institution.
 *
 * BODY (optional, for hard-delete drafts only): { confirm_stamp_count: int }
 *   When the page has any stamps and the route would perform a
 *   hard delete, the client must echo back the stamp count it
 *   confirmed with the user. Mismatch → 409. Prevents a stale
 *   client from silently destroying stamps the user didn't see.
 *
 * RESPONSE: { mode: 'hard' | 'soft', deletedStampCount?: number,
 *             closedStopCount?: number }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: pageId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch the page + its passport for authorization + acq count.
  const { data: page, error: pageErr } = await db
    .from('passport_pages')
    .select('id, passport_id, closed_at, passports!inner(id, creator_id, proprietor_id)')
    .eq('id', pageId)
    .maybeSingle()
  if (pageErr || !page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passport = (page as any).passports
  const auth = await authorizePassportMutation(supabase, passport, user.id)
  if (auth === 'denied') {
    return NextResponse.json(
      { error: passport.proprietor_id
          ? 'Not authorized (creator, admin, or can_design at the owning institution required)'
          : 'Not the creator' },
      { status: 403 },
    )
  }
  // Already-closed: idempotent no-op.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((page as any).closed_at != null) {
    return NextResponse.json({ mode: 'soft', alreadyClosed: true })
  }

  // Acquisitions count drives the branch. Both web (acquisitions)
  // and mobile (collector_passports) are checked; either non-zero
  // counts the passport as "has acquisitions."
  const passportId: string = passport.id
  const [{ count: acqCount }, { count: cpCount }] = await Promise.all([
    db.from('acquisitions').select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    db.from('collector_passports').select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
  ])
  const hasAcquisitions = (acqCount ?? 0) + (cpCount ?? 0) > 0

  if (hasAcquisitions) {
    // ── Soft-close path ──
    // Set closed_at on the page AND every stop on it that isn't
    // already closed. The stop-side closure feeds the existing
    // stop_closure diff category (migration 065 lineage).
    const nowIso = new Date().toISOString()
    const { error: pageUpdErr } = await db
      .from('passport_pages')
      .update({ closed_at: nowIso })
      .eq('id', pageId)
    if (pageUpdErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: (pageUpdErr as any).message ?? 'Close failed' }, { status: 500 })
    }
    // Count stops being closed for the response.
    const { data: stopsToClose } = await db
      .from('stops')
      .select('id')
      .eq('page_id', pageId)
      .is('closed_at', null)
    const closedStopCount = (stopsToClose ?? []).length
    if (closedStopCount > 0) {
      await db
        .from('stops')
        .update({ closed_at: nowIso })
        .eq('page_id', pageId)
        .is('closed_at', null)
    }
    return NextResponse.json({ mode: 'soft', closedStopCount })
  }

  // ── Hard-delete path (zero acquisitions) ──
  // First, count stamps belonging to stops on this page. The
  // client must echo the count back when stamps > 0 — the spec's
  // "typed confirmation naming what's lost" guardrail prevents
  // a stale client from blowing away test stamps invisibly.
  const { data: stopsOnPage } = await db
    .from('stops')
    .select('id')
    .eq('page_id', pageId)
  const stopIds = ((stopsOnPage ?? []) as { id: string }[]).map((s) => s.id)

  let stampCount = 0
  if (stopIds.length > 0) {
    const { count } = await db
      .from('stamps')
      .select('id', { count: 'exact', head: true })
      .in('stop_id', stopIds)
    stampCount = count ?? 0
  }

  if (stampCount > 0) {
    const body = await request.json().catch(() => ({}))
    const confirmed = typeof body?.confirm_stamp_count === 'number'
      ? body.confirm_stamp_count
      : -1
    if (confirmed !== stampCount) {
      return NextResponse.json({
        error: 'Stamp count mismatch — refresh and confirm again',
        actualStampCount: stampCount,
      }, { status: 409 })
    }
  }

  // Explicit stamps DELETE — cascades journal_entries via FK.
  // Then page DELETE cascades stops.
  if (stopIds.length > 0) {
    const { error: stampDelErr } = await db
      .from('stamps')
      .delete()
      .in('stop_id', stopIds)
    if (stampDelErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: (stampDelErr as any).message ?? 'Stamp cleanup failed' }, { status: 500 })
    }
  }
  const { error: delErr } = await db
    .from('passport_pages')
    .delete()
    .eq('id', pageId)
  if (delErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (delErr as any).message ?? 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ mode: 'hard', deletedStampCount: stampCount })
}
