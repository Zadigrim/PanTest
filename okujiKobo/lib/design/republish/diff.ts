/**
 * Republish diff engine.
 *
 * Compares a captured snapshot of the previously-published
 * state (from `passport_published_snapshots`) against the
 * current live state (the editor's draft after unpublish),
 * categorizes every delta, and returns a summary the
 * republish route uses to decide:
 *
 *   1. Block (other > 0 and not admin-overridden)
 *   2. Require justification + factual_text flag in the
 *      audit log (factual_text > 0)
 *   3. Allow (critical changes only — location, verification,
 *      stop closure)
 *
 * "Conservative" factual-text scope per Nathan's call:
 *   factual_text fields = stops.name + stops.learning_objective
 *                       + stops.journal_prompt
 *                       + passport.title + passport.description.
 * Element-level body copy stays in `other` (blocked).
 *
 * Stop closure is detected two ways:
 *   1. snapshot stop's closed_at was NULL, draft's is non-NULL
 *      → newly closed.
 *   2. stop id present in snapshot but absent from draft
 *      → removed (equivalent to closure for holder rendering;
 *      a removed stop is shown as closed, not vanished).
 */

import type { PassportSnapshot, SnapshotStop } from './snapshot'

export type DiffCategory =
  | 'location_data'
  | 'verification_mechanics'
  | 'stop_closure'
  | 'page_closure'
  | 'page_reorder'
  | 'factual_text'
  | 'other'

export interface DiffSummary {
  /** Per-category change counts. Sum is the total number of
   *  distinct edits the diff observed (not the number of
   *  fields — one stop with three location-field deltas
   *  counts as a single `location_data` change for the
   *  holder-facing summary). */
  counts: Record<DiffCategory, number>
  /** Specific deltas, suitable for the admin moderation log
   *  and the holder-facing what-changed line composer. */
  changes: DiffChange[]
}

export type DiffChange =
  | { category: 'location_data';           stop_id: string; fields: string[] }
  | { category: 'verification_mechanics';  stop_id: string; fields: string[] }
  | { category: 'stop_closure';            stop_id: string; reason: 'closed' | 'removed' }
  | { category: 'page_closure';            page_id: string; reason: 'closed' | 'removed' }
  | { category: 'page_reorder';            order: string[] } // new page-id sequence
  | { category: 'factual_text';            scope: 'passport' | 'stop'; entity_id: string; fields: string[] }
  | { category: 'other';                   detail: string }

const LOCATION_FIELDS: (keyof SnapshotStop)[] = [
  'lat', 'lng',
  'address_street', 'address_city', 'address_state', 'address_zip', 'country',
]
const VERIFICATION_FIELDS: (keyof SnapshotStop)[] = [
  'experience_type', 'experience_verification_method',
  'verification_tier', 'verification_radius_meters',
  'qr_code_token',
]
const STOP_FACTUAL_TEXT_FIELDS: (keyof SnapshotStop)[] = [
  'name', 'learning_objective', 'journal_prompt',
]

export function diffSnapshots(
  prior: PassportSnapshot,
  next: PassportSnapshot,
): DiffSummary {
  const changes: DiffChange[] = []

  // ── Passport-level factual-text ──
  if (norm(prior.passport.title) !== norm(next.passport.title)) {
    changes.push({
      category: 'factual_text',
      scope: 'passport',
      entity_id: next.passport.id,
      fields: ['title'],
    })
  }
  if (norm(prior.passport.description) !== norm(next.passport.description)) {
    // Merge if title also changed: keep entries per-field for the
    // log, but the holder-facing composer collapses them.
    const existing = changes.find(
      (c) => c.category === 'factual_text' && c.scope === 'passport'
              && c.entity_id === next.passport.id,
    )
    if (existing && existing.category === 'factual_text') {
      existing.fields.push('description')
    } else {
      changes.push({
        category: 'factual_text',
        scope: 'passport',
        entity_id: next.passport.id,
        fields: ['description'],
      })
    }
  }

  // ── Passport-level OTHER (cosmetic / non-critical) ──
  if ((prior.passport.price_cents ?? null) !== (next.passport.price_cents ?? null)) {
    changes.push({ category: 'other', detail: 'price_cents changed' })
  }
  if (norm(prior.passport.expected_spend_tier) !== norm(next.passport.expected_spend_tier)) {
    changes.push({ category: 'other', detail: 'expected_spend_tier changed' })
  }
  if (norm(prior.passport.cover_image_url) !== norm(next.passport.cover_image_url)) {
    // Cover image regenerates at every publish (publish-images.tsx
    // upserts at the same path) — so the URL itself rarely changes
    // unless a hash/version is appended. We classify any visible
    // change as `other` to be conservative.
    changes.push({ category: 'other', detail: 'cover_image_url changed' })
  }

  // ── Pages: closure / removal / reorder / title ──
  //
  // Closure: snapshot.closed_at NULL → next.closed_at non-NULL.
  // Removal: id present in snapshot, absent in next. Both flow
  // through 'page_closure' — holder render treats them identically
  // (the page disappears from active rendering; any earned stamps
  // on its stops remain via the existing stop_closure preservation).
  //
  // Reorder: same set of ids in a different sequence. Single
  // 'page_reorder' change carrying the new id sequence. Verdict
  // permits it — reordering doesn't lose any holder-earned data.
  //
  // Per-page title delta stays in 'other' (cosmetic; blocks unless
  // admin-overridden). M-page-ops did not carve title editing out
  // of the existing block.
  const priorPageById = new Map(prior.pages.map((p) => [p.id, p]))
  const nextPageById  = new Map(next.pages.map((p) => [p.id, p]))

  // Removed pages — id absent from next.
  for (const op of prior.pages) {
    if (!nextPageById.has(op.id)) {
      changes.push({ category: 'page_closure', page_id: op.id, reason: 'removed' })
    }
  }
  // Newly closed pages — id present, closed_at went NULL → non-NULL.
  for (const np of next.pages) {
    const op = priorPageById.get(np.id)
    if (op && op.closed_at == null && np.closed_at != null) {
      changes.push({ category: 'page_closure', page_id: np.id, reason: 'closed' })
    }
  }
  // Page additions — id present in next, absent from prior. These
  // are content additions (not corrections); classified as 'other'
  // so the republish blocks unless admin-overridden, parallel to
  // the stop-addition rule.
  for (const np of next.pages) {
    if (!priorPageById.has(np.id)) {
      changes.push({ category: 'other', detail: `new page added (${np.id})` })
    }
  }
  // Title deltas on pages present in both — cosmetic, 'other'.
  for (const np of next.pages) {
    const op = priorPageById.get(np.id)
    if (op && norm(op.title) !== norm(np.title)) {
      changes.push({ category: 'other', detail: `page title changed (${np.id})` })
    }
  }
  // Reorder detection — same set of ACTIVE ids (excluding closed
  // and removed), different sequence. Single change carrying the
  // new id order. Detected over active pages only so a closure
  // doesn't double-count as a reorder.
  const priorActiveIds = prior.pages
    .filter((p) => p.closed_at == null && nextPageById.has(p.id))
    .sort((a, b) => a.page_order - b.page_order)
    .map((p) => p.id)
  const nextActiveIds = next.pages
    .filter((p) => p.closed_at == null && priorPageById.has(p.id))
    .sort((a, b) => a.page_order - b.page_order)
    .map((p) => p.id)
  if (priorActiveIds.length === nextActiveIds.length
      && priorActiveIds.length > 0
      && priorActiveIds.some((id, i) => id !== nextActiveIds[i])) {
    changes.push({ category: 'page_reorder', order: nextActiveIds })
  }

  // ── Stops: walk both sides ──
  const priorStopById = new Map(prior.stops.map((s) => [s.id, s]))
  const nextStopById  = new Map(next.stops.map((s)  => [s.id, s]))

  // Removed stops → stop_closure (treat as closure on the
  // holder side; the spec is explicit that holder records
  // persist regardless of removal).
  for (const ps of prior.stops) {
    if (!nextStopById.has(ps.id)) {
      changes.push({ category: 'stop_closure', stop_id: ps.id, reason: 'removed' })
    }
  }

  // Added stops → `other` (a brand-new stop after acquisitions
  // exist isn't a correction — it's content addition. Spec
  // doesn't carve this out; classified as `other` so it
  // blocks unless admin-overridden).
  for (const ns of next.stops) {
    if (!priorStopById.has(ns.id)) {
      changes.push({ category: 'other', detail: `new stop added (${ns.id})` })
    }
  }

  // Per-stop field deltas.
  for (const ns of next.stops) {
    const ps = priorStopById.get(ns.id)
    if (!ps) continue  // handled in "added" above

    const locFields    = diffFields(ps, ns, LOCATION_FIELDS)
    const vmFields     = diffFields(ps, ns, VERIFICATION_FIELDS)
    const textFields   = diffFields(ps, ns, STOP_FACTUAL_TEXT_FIELDS)

    // Newly closed (closed_at NULL → non-NULL).
    const newlyClosed = ps.closed_at === null && ns.closed_at !== null

    if (locFields.length > 0)  changes.push({ category: 'location_data',          stop_id: ns.id, fields: locFields })
    if (vmFields.length  > 0)  changes.push({ category: 'verification_mechanics', stop_id: ns.id, fields: vmFields  })
    if (textFields.length > 0) changes.push({ category: 'factual_text', scope: 'stop', entity_id: ns.id, fields: textFields })
    if (newlyClosed)           changes.push({ category: 'stop_closure', stop_id: ns.id, reason: 'closed' })

    // stop_order change → cosmetic.
    if (ps.stop_order !== ns.stop_order) {
      changes.push({ category: 'other', detail: `stop_order changed (${ns.id})` })
    }
    // page_id change (moved between pages) → cosmetic.
    if (ps.page_id !== ns.page_id) {
      changes.push({ category: 'other', detail: `stop moved between pages (${ns.id})` })
    }
  }

  // ── Counts ──
  const counts: Record<DiffCategory, number> = {
    location_data: 0,
    verification_mechanics: 0,
    stop_closure: 0,
    page_closure: 0,
    page_reorder: 0,
    factual_text: 0,
    other: 0,
  }
  for (const c of changes) counts[c.category]++

  return { counts, changes }
}

/** Decision: should this republish be allowed without admin
 *  override? Returns:
 *    'ok'              — critical-only (or no changes); allow
 *                        with the standard justification.
 *    'ok_factual_text' — critical OR factual_text; allow,
 *                        flag the audit log.
 *    'blocked'         — `other` present; require admin
 *                        override or designer reverts edits. */
export type Verdict = 'ok' | 'ok_factual_text' | 'blocked'

export function verdictFor(summary: DiffSummary): Verdict {
  if (summary.counts.other > 0) return 'blocked'
  if (summary.counts.factual_text > 0) return 'ok_factual_text'
  return 'ok'
}

/** Compose a short holder-facing line from the diff. Hits the
 *  audit log's `what_changed` column (3..200 chars). The
 *  designer's explicit phrasing wins if they provide one —
 *  this is the fallback default. */
export function defaultWhatChanged(summary: DiffSummary): string {
  const parts: string[] = []
  if (summary.counts.location_data > 0) {
    const n = summary.counts.location_data
    parts.push(`Coordinates or address corrected on ${n} stop${n === 1 ? '' : 's'}`)
  }
  if (summary.counts.verification_mechanics > 0) {
    const n = summary.counts.verification_mechanics
    parts.push(`Verification updated on ${n} stop${n === 1 ? '' : 's'}`)
  }
  if (summary.counts.stop_closure > 0) {
    const n = summary.counts.stop_closure
    parts.push(`${n} stop${n === 1 ? '' : 's'} closed`)
  }
  if (summary.counts.page_closure > 0) {
    const n = summary.counts.page_closure
    parts.push(`${n} page${n === 1 ? '' : 's'} removed`)
  }
  if (summary.counts.page_reorder > 0) {
    parts.push('Pages reordered')
  }
  if (summary.counts.factual_text > 0) {
    parts.push('Text corrections')
  }
  return parts.join(' · ') || 'Correction applied'
}

// ── Helpers ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffFields<T extends Record<string, any>>(a: T, b: T, fields: (keyof T)[]): string[] {
  const out: string[] = []
  for (const f of fields) {
    if (norm(a[f]) !== norm(b[f])) out.push(String(f))
  }
  return out
}

function norm(v: unknown): string {
  // Whitespace + null/undefined normalization so trivial
  // editor-cleanup (e.g. trim) doesn't look like a real
  // factual-text change. Numbers + booleans stringify cleanly.
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  return String(v)
}
