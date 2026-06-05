import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { captureLiveSnapshot, readLatestSnapshot } from '@/lib/design/republish/snapshot'
import { diffSnapshots, verdictFor } from '@/lib/design/republish/diff'

/**
 * POST /api/passports/:id/republish
 *
 * Republishes a previously-published passport to its existing
 * holders. The behavior split lives here:
 *
 *   1. Zero acquisitions  → unrestricted republish (matches
 *                           a first publish; the publish flow
 *                           does its own checklist).
 *
 *   2. With acquisitions  → CORRECTION-ONLY gate:
 *      * Reads the latest snapshot
 *        (passport_published_snapshots) — the previous
 *        published state.
 *      * Captures the current LIVE state (the post-unpublish
 *        edits).
 *      * Diffs (lib/design/republish/diff.ts) and categorizes
 *        every delta.
 *      * Verdict 'ok' or 'ok_factual_text' → write log,
 *        write fresh snapshot, flip is_published=true.
 *      * Verdict 'blocked' → 422 with the diff summary so
 *        the UI can render "these edits aren't corrections".
 *
 * Body: { justification, whatChanged, adminOverride? }.
 *   justification: required, 10-1000 chars. Specific (the
 *     designer is asked to justify the claim; the admin log
 *     reads these).
 *   whatChanged: required, 3-200 chars. Holder-facing line
 *     for the dismissible notice.
 *   adminOverride: optional boolean — only honored if the
 *     caller is a platform admin AND the verdict was 'blocked'.
 *     The override is logged with `admin_override = true` +
 *     `admin_override_by = caller`.
 *
 * Side effects (in order, transactional in spirit but not
 * SQL-transactional — see below):
 *   1. Insert into passport_republish_log
 *   2. Insert a fresh snapshot of the now-published state
 *   3. UPDATE passports SET is_published=true, status='published',
 *      published_at=now()
 *
 * Order rationale: if the publish UPDATE failed but the log
 * already landed, holders would still see a "draft" but get
 * a notice for a republish that didn't happen. So we hold
 * the UPDATE for last; on a log/snapshot write failure the
 * publish never fires. The reverse error (UPDATE succeeded
 * but log failed) can't happen because UPDATE is last.
 *
 * Image regeneration is left to the CALLER (the PublishFlow
 * already runs generateAndUploadPassportImages after a
 * successful publish — same path). This route is the
 * permission + audit gate; image work is idempotent and
 * stays in the client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { justification?: string; whatChanged?: string; adminOverride?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const justification = (body.justification ?? '').trim()
  const whatChanged   = (body.whatChanged   ?? '').trim()
  const wantsOverride = body.adminOverride === true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ── Ownership + state check ──
  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, is_published')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }
  // Caller must be creator OR admin.
  const { data: prof } = await db
    .from('profiles').select('is_platform_admin').eq('id', user.id).single()
  const callerIsAdmin = !!prof?.is_platform_admin
  if (passport.creator_id !== user.id && !callerIsAdmin) {
    return NextResponse.json({ error: 'Not the creator' }, { status: 403 })
  }
  if (passport.is_published) {
    return NextResponse.json({ error: 'Passport is already published' }, { status: 409 })
  }

  // ── Holder count ──
  const [{ count: acqCount }, { count: cpCount }] = await Promise.all([
    db.from('acquisitions')
      .select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    db.from('collector_passports')
      .select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
  ])
  const holderCount = Math.max(acqCount ?? 0, cpCount ?? 0)

  // ── Zero-holder path — unrestricted ──
  // Still snapshot + write the publish-event row in case
  // holders arrive later; skip the diff/log/justification.
  if (holderCount === 0) {
    const snap = await captureLiveSnapshot(supabase, passportId)
    const svc = serviceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc as any).from('passport_published_snapshots').insert({
      passport_id: passportId, published_by: user.id, snapshot: snap,
    })
    const { error: updErr } = await db
      .from('passports')
      .update({ is_published: true, status: 'published', published_at: new Date().toISOString() })
      .eq('id', passportId)
    if (updErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ error: (updErr as any).message ?? 'Publish failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, holderCount: 0, restricted: false })
  }

  // ── With-holder path — correction gate ──
  if (justification.length < 10 || justification.length > 1000) {
    return NextResponse.json({ error: 'Justification must be 10-1000 characters' }, { status: 400 })
  }
  if (whatChanged.length < 3 || whatChanged.length > 200) {
    return NextResponse.json({ error: 'What-changed line must be 3-200 characters' }, { status: 400 })
  }

  const prior = await readLatestSnapshot(supabase, passportId)
  if (!prior) {
    // No previous snapshot but acquisitions > 0 — only happens
    // for legacy passports published before migration 063
    // landed. We let it pass (treat as ok, no diff), but flag
    // the audit log so an admin can review.
    const next = await captureLiveSnapshot(supabase, passportId)
    return await commitPublish({
      supabase, db, passportId, userId: user.id,
      summary: { counts: { location_data: 0, verification_mechanics: 0, stop_closure: 0, factual_text: 0, other: 0 }, changes: [] },
      justification: `[no prior snapshot — legacy passport] ${justification}`,
      whatChanged,
      factualTextFlagged: false,
      adminOverride: false, adminOverrideBy: null,
      nextSnapshot: next,
    })
  }

  const next     = await captureLiveSnapshot(supabase, passportId)
  const summary  = diffSnapshots(prior, next)
  const verdict  = verdictFor(summary)

  if (verdict === 'blocked' && !(wantsOverride && callerIsAdmin)) {
    return NextResponse.json({
      error: 'blocked',
      verdict,
      summary,
      reason: 'These edits aren’t corrections. Republishing to holders is for critical fixes only — revert these changes or contact support.',
    }, { status: 422 })
  }

  return await commitPublish({
    supabase, db, passportId, userId: user.id,
    summary,
    justification,
    whatChanged,
    factualTextFlagged: summary.counts.factual_text > 0,
    adminOverride: verdict === 'blocked' && wantsOverride && callerIsAdmin,
    adminOverrideBy: verdict === 'blocked' && wantsOverride && callerIsAdmin ? user.id : null,
    nextSnapshot: next,
  })
}

// ── Commit path ──
// Splits the success-side writes (log → snapshot → publish-UPDATE)
// into one helper so the zero-holder and with-holder paths
// share the failure-order discipline (UPDATE last).
async function commitPublish(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any
  passportId: string
  userId: string
  summary: ReturnType<typeof diffSnapshots>
  justification: string
  whatChanged: string
  factualTextFlagged: boolean
  adminOverride: boolean
  adminOverrideBy: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextSnapshot: any
}) {
  const svc = serviceClient()

  // 1. Log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: logErr } = await (svc as any).from('passport_republish_log').insert({
    passport_id:          args.passportId,
    republished_by:       args.userId,
    justification:        args.justification,
    what_changed:         args.whatChanged,
    diff_summary:         args.summary,
    factual_text_flagged: args.factualTextFlagged,
    admin_override:       args.adminOverride,
    admin_override_by:    args.adminOverrideBy,
  })
  if (logErr) {
    return NextResponse.json({ error: `audit log failed: ${logErr.message}` }, { status: 500 })
  }

  // 2. Snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: snapErr } = await (svc as any).from('passport_published_snapshots').insert({
    passport_id:  args.passportId,
    published_by: args.userId,
    snapshot:     args.nextSnapshot,
  })
  if (snapErr) {
    return NextResponse.json({ error: `snapshot failed: ${snapErr.message}` }, { status: 500 })
  }

  // 3. UPDATE last — see route docblock for ordering rationale.
  const { error: updErr } = await args.db
    .from('passports')
    .update({ is_published: true, status: 'published', published_at: new Date().toISOString() })
    .eq('id', args.passportId)
  if (updErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (updErr as any).message ?? 'Publish failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    summary: args.summary,
    factualTextFlagged: args.factualTextFlagged,
    adminOverride: args.adminOverride,
  })
}

function serviceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}
