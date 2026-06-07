import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'

/**
 * DELETE /api/passports/:id
 *
 * Permanently deletes a passport. Permitted ONLY when:
 *   * caller is the creator (or platform admin), AND
 *   * the passport has ZERO acquisitions AND ZERO
 *     collector_passports rows.
 *
 * The hard rule is acquisition-locking: a passport someone
 * has acquired is NEVER deletable, even from an unpublished
 * state. The closure cascade pattern (migration 049) — for
 * account-closure of an owner — re-homes acquired passports
 * to a custodial account instead of deleting them; this
 * route only handles the path where deletion is unambiguously
 * safe.
 *
 * Cascades:
 *   * passport_pages.ON DELETE CASCADE → page_elements,
 *     completion_tokens, presence_sessions, etc. (see
 *     migration 012's REFERENCES … ON DELETE clauses).
 *   * passport_published_snapshots ON DELETE CASCADE
 *     (migration 063).
 *   * passport_republish_log ON DELETE CASCADE (migration
 *     064).
 *   * design_assets: PRESERVED (per migration 052 — assets
 *     can be referenced by multiple passports; deleting a
 *     passport must not orphan another's stamps).
 *
 * Storage: passport-pages bucket (cover.png + page-N.png) is
 * NOT cleaned here. Storage cleanup is a separate concern —
 * Supabase's storage_objects table doesn't FK to passports,
 * and an orphaned image is cheaper than a cascade failure.
 * A nightly script can sweep it later.
 *
 * Response: { ok: true } on success, structured 4xx
 * elsewhere.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, proprietor_id, title')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  // Permission: creator, admin, OR institutional employee with
  // can_design at the passport's proprietor institution. The third
  // path lets institution-owned passports be deleted by the team
  // that designs them — matching the RLS expansion in migration 038.
  const auth = await authorizePassportMutation(supabase, passport, user.id)
  if (auth === 'denied') {
    return NextResponse.json(
      { error: passport.proprietor_id
          ? 'Not authorized (creator, admin, or can_design at the owning institution required)'
          : 'Not the creator' },
      { status: 403 },
    )
  }

  // Zero-acquisition guard. Both surfaces must be zero.
  const [{ count: acqCount }, { count: cpCount }] = await Promise.all([
    db.from('acquisitions')
      .select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    db.from('collector_passports')
      .select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
  ])
  const total = (acqCount ?? 0) + (cpCount ?? 0)
  if (total > 0) {
    return NextResponse.json({
      error: 'Passport has acquisitions and cannot be deleted',
      holderCount: Math.max(acqCount ?? 0, cpCount ?? 0),
    }, { status: 409 })
  }

  // Delete. ON DELETE CASCADE on passport_pages does the
  // rest of the row tree.
  const { error: delErr } = await db.from('passports').delete().eq('id', passportId)
  if (delErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (delErr as any).message ?? 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
