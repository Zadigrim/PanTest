// Persist helpers — every DB write in the designer goes through these so
// a single code path handles error surfacing. The old pattern was:
//
//   await supabase.from('passport_pages').update({ ... }).eq('id', x)
//
// which silently swallowed errors (the result was never destructured, so
// RLS denials, network blips, etc. left the local store updated but the
// DB stale — the user saw their work appear, navigated away, and on
// reload everything was gone).
//
// These helpers set `saveError` on the store on failure; the SaveIndicator
// surfaces that to the user with a Retry button. They return a boolean so
// callers can optionally roll back optimistic local state.

import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from './passport-store'
import { revalidateLocationAudit } from '@/app/actions/audit'

// Fields whose change on a `stops` row affects the location-audit
// surface (dashboard HeroAlert + AttentionQueue audit-summary,
// /dashboard/audit list). A safeUpdate that touches any of these
// fires the revalidateLocationAudit server action so the next
// visit to those surfaces shows fresh counts.
const LOCATION_AUDIT_FIELDS = new Set([
  'lat',
  'lng',
  'address_street',
  'address_city',
  'experience_type',
  'experience_verification_method',
  'verification_tier',
])

function patchTouchesAudit(patch: Record<string, unknown>): boolean {
  for (const k of Object.keys(patch)) {
    if (LOCATION_AUDIT_FIELDS.has(k)) return true
  }
  return false
}

function describeError(err: { message?: string | null; code?: string | null; details?: string | null; hint?: string | null } | null | undefined): string {
  if (!err) return 'Save failed'
  if (err.message?.trim()) return err.message
  if (err.details?.trim()) return err.details
  if (err.hint?.trim()) return err.hint
  return `Save failed${err.code ? ` (${err.code})` : ''}`
}

// In-flight counter. Lets the SaveIndicator reflect actual write activity.
let inflight = 0
const pendingResolvers: Array<() => void> = []

// ── Write serialization ──────────────────────────────────────────────────────
//
// Concurrent UPDATEs against Supabase chain row locks behind each other
// and one of them eventually exceeds the 8s statement timeout (Postgres
// error 57014). The 30f80e1 fix made saveAll's internal loop sequential
// for that reason; this serialize wrapper extends the same guarantee to
// every write the persistence layer issues — saveAll, safeUpdate,
// safeInsert, and the debounced per-mutation writes — so a burst of
// drag/blur edits or a Promise.all flush never piles up against the
// timeout wall. The chain is bounded; each write only references the
// previous one, so finished writes are garbage-collected as the chain
// advances.
let writeChain: Promise<unknown> = Promise.resolve()
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeChain.catch(() => undefined).then(fn)
  // Don't let one failure poison the chain — subsequent writes start
  // from a fresh resolved tail. Each write still surfaces its own error
  // via its caller's try/catch.
  writeChain = result.then(() => undefined, () => undefined)
  return result
}

function inc() {
  inflight++
  usePassportStore.getState().setSaving(true)
}

function dec() {
  inflight = Math.max(0, inflight - 1)
  if (inflight === 0) {
    // Resolve awaitPending callers as soon as the writes they triggered
    // finish — they wanted to wait for those specific writes, not for
    // future debounces a user might schedule mid-await.
    while (pendingResolvers.length) pendingResolvers.shift()?.()

    const fullyInSync =
      debounceTimers.size === 0 &&
      retryQueue.length === 0 &&
      !usePassportStore.getState().saveError
    if (fullyInSync) {
      usePassportStore.getState().markSaved()
    } else {
      // Either debounces still pending (store ahead of DB → keep
      // isDirty=true), or a save failed (keep saveError visible). Either
      // way, this batch of writes is done — drop the "Saving…" state.
      // Critically: do NOT call markSaved here, since that would wipe
      // isDirty even though edits made mid-save haven't been written
      // yet — the silent-data-loss race we are fixing.
      usePassportStore.getState().setSaving(false)
    }
  }
}

/** Resolves when all currently-running safeUpdate / safeInsert calls finish. */
export async function awaitPending(): Promise<void> {
  // Flush pending debounced writes first so callers don't sit through
  // the debounce window before in-flight tracking catches them.
  await flushDebounced()
  if (inflight === 0) return
  return new Promise<void>((resolve) => pendingResolvers.push(resolve))
}

// ── Debounced per-mutation persistence ───────────────────────────────────────
//
// High-frequency mutations (drags, slider/range inputs, every keystroke)
// route through debouncedUpdate instead of safeUpdate. Updates targeting
// the same (table, eqColumn, eqValue) coalesce: the patch is merged in
// place and a single write fires DEBOUNCE_MS after the last call.
//
// The 30f80e1 loop fix replaced 10s polling with per-mutation writes;
// this layer adds debouncing so 60Hz drag streams become one write at
// drag-end instead of sixty. Loop-safe because each timer fires at
// most once and clears itself before issuing safeUpdate.
//
// 1500ms (was 600): with per-row RLS cost on stops UPDATEs, a short
// window fired a write at every brief pause while the user was still
// actively editing the same stop. The longer window waits until they
// have actually stopped before issuing the coalesced write.

const DEBOUNCE_MS = 1500

interface DebounceMeta { table: string; eqColumn: string; eqValue: string | number }

const debounceTimers  = new Map<string, ReturnType<typeof setTimeout>>()
const pendingPatches  = new Map<string, Record<string, unknown>>()
const pendingMeta     = new Map<string, DebounceMeta>()

function debounceKey(table: string, eqColumn: string, eqValue: string | number): string {
  return `${table}::${eqColumn}::${eqValue}`
}

/** Schedule a coalesced write. Repeated calls with the same target merge. */
export function debouncedUpdate(
  table: string,
  patch: Record<string, unknown>,
  eqColumn: string,
  eqValue: string | number,
): void {
  if (Object.keys(patch).length === 0) return
  const key = debounceKey(table, eqColumn, eqValue)
  pendingPatches.set(key, { ...(pendingPatches.get(key) ?? {}), ...patch })
  pendingMeta.set(key, { table, eqColumn, eqValue })

  const prev = debounceTimers.get(key)
  if (prev) clearTimeout(prev)

  const timer = setTimeout(() => {
    debounceTimers.delete(key)
    const merged = pendingPatches.get(key)
    const meta   = pendingMeta.get(key)
    pendingPatches.delete(key)
    pendingMeta.delete(key)
    if (merged && meta) void safeUpdate(meta.table, merged, meta.eqColumn, meta.eqValue)
  }, DEBOUNCE_MS)
  debounceTimers.set(key, timer)
}

/** Drain pending debounced writes immediately; resolves once their writes finish. */
export function flushDebounced(): Promise<void> {
  const promises: Promise<unknown>[] = []
  for (const [key, timer] of Array.from(debounceTimers.entries())) {
    clearTimeout(timer)
    debounceTimers.delete(key)
    const merged = pendingPatches.get(key)
    const meta   = pendingMeta.get(key)
    pendingPatches.delete(key)
    pendingMeta.delete(key)
    if (merged && meta) {
      promises.push(safeUpdate(meta.table, merged, meta.eqColumn, meta.eqValue))
    }
  }
  return Promise.all(promises).then(() => undefined)
}

export function pendingDebouncedCount(): number {
  return debounceTimers.size
}

// ── Retry queue ──────────────────────────────────────────────────────────────

interface QueuedUpdate {
  kind: 'update'
  table: string
  patch: Record<string, unknown>
  eqColumn: string
  eqValue: string | number
}
interface QueuedInsert {
  kind: 'insert'
  table: string
  row: Record<string, unknown>
  selectClause?: string
}
type QueuedWrite = QueuedUpdate | QueuedInsert

const retryQueue: QueuedWrite[] = []

export function pendingRetryCount(): number {
  return retryQueue.length
}

export async function retryFailed(): Promise<void> {
  if (retryQueue.length === 0) {
    usePassportStore.getState().setSaveError(null)
    if (inflight === 0) usePassportStore.getState().markSaved()
    return
  }
  const items = retryQueue.splice(0)
  usePassportStore.getState().setSaveError(null)
  for (const item of items) {
    if (item.kind === 'update') {
      await safeUpdate(item.table, item.patch, item.eqColumn, item.eqValue)
    } else {
      await safeInsert(item.table, item.row, item.selectClause)
    }
  }
}

// ── Atomic helpers (use for one-off writes that still happen automatically:
//    inserts of new rows, file uploads, etc.) ──────────────────────────────

export async function safeUpdate(
  table: string,
  patch: Record<string, unknown>,
  eqColumn: string,
  eqValue: string | number,
): Promise<boolean> {
  inc()
  try {
    return await serialize(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any
      try {
        let { error } = await db.from(table).update(patch).eq(eqColumn, eqValue)
        // 57014 = canceling statement due to statement timeout. Postgres
        // hits this on pool pressure / RLS-eval slow paths; the SAME row
        // updated 500ms later usually goes through cleanly because the
        // contention has cleared. One auto-retry masks the common
        // transient without hiding a real recurring problem (a second
        // 57014 falls through to the retryQueue + visible Save failed).
        if (error && (error as { code?: string }).code === '57014') {
          await new Promise((r) => setTimeout(r, 500))
          const retry = await db.from(table).update(patch).eq(eqColumn, eqValue)
          error = retry.error
        }
        if (error) {
          console.error('[persist] safeUpdate failed', { table, eqColumn, eqValue, patch, error })
          usePassportStore.getState().setSaveError(describeError(error))
          retryQueue.push({ kind: 'update', table, patch, eqColumn, eqValue })
          return false
        }
        // Fire-and-forget revalidation of the location-audit
        // surfaces when a stops write changed any field the audit
        // depends on. The server action runs out-of-band; we don't
        // await it (a failed revalidation just means stale data
        // for one more page load, never blocks save UX).
        if (table === 'stops' && patchTouchesAudit(patch)) {
          void revalidateLocationAudit().catch(() => {})
        }
        return true
      } catch (err) {
        console.error('[persist] safeUpdate threw', { table, eqColumn, eqValue, patch, err })
        const msg = err instanceof Error ? err.message : 'Save failed'
        usePassportStore.getState().setSaveError(msg)
        retryQueue.push({ kind: 'update', table, patch, eqColumn, eqValue })
        return false
      }
    })
  } finally {
    dec()
  }
}

export async function safeInsert<T = unknown>(
  table: string,
  row: Record<string, unknown>,
  selectClause?: string,
): Promise<T | null> {
  inc()
  try {
    return await serialize(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = createClient() as any
      try {
        const q = db.from(table).insert(row)
        const { data, error } = selectClause ? await q.select(selectClause).single() : await q
        if (error) {
          console.error('[persist] safeInsert failed', { table, row, error })
          usePassportStore.getState().setSaveError(describeError(error))
          retryQueue.push({ kind: 'insert', table, row, selectClause })
          return null
        }
        return (data ?? null) as T | null
      } catch (err) {
        console.error('[persist] safeInsert threw', { table, row, err })
        const msg = err instanceof Error ? err.message : 'Save failed'
        usePassportStore.getState().setSaveError(msg)
        retryQueue.push({ kind: 'insert', table, row, selectClause })
        return null
      }
    })
  } finally {
    dec()
  }
}

// ── Explicit save ────────────────────────────────────────────────────────────
//
// saveAll() is the manual flush + sweep (Save button, navigate-away,
// autosave backstop). It writes the FULL editable surface of each row it
// touches — but only for rows the store has marked dirty since the last
// successful save (dirtyPassport / dirtyPageIds / dirtyStopIds). Sweeping
// every row regardless of change was N sequential UPDATEs paying per-row
// RLS cost on a many-stop passport; the dirty filter makes Save scale
// with what actually changed.
//
// Safety net: if isDirty is set but all three dirty sets are empty (a
// mutation that forgot to record itself), fall back to the full sweep —
// the same catch-all useAutosave documents.

interface BatchError { table: string; id: string; message: string }

// Run an UPDATE under serialize() with a one-shot 57014 retry — the
// statement-timeout slow path is usually transient (pool pressure,
// momentary RLS-eval spike) and the SAME UPDATE 500ms later goes
// through. A second 57014 surfaces normally so a real recurring
// problem still raises a Save failed banner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateWithRetry(db: any, table: string, patch: Record<string, unknown>, eqColumn: string, eqValue: string): Promise<{ error: { message?: string; code?: string } | null }> {
  return serialize<{ error: { message?: string; code?: string } | null }>(async () => {
    let res = await db.from(table).update(patch).eq(eqColumn, eqValue)
    if (res.error && (res.error as { code?: string }).code === '57014') {
      await new Promise((r) => setTimeout(r, 500))
      res = await db.from(table).update(patch).eq(eqColumn, eqValue)
    }
    return { error: res.error }
  })
}

export async function saveAll(): Promise<BatchError[]> {
  // Drain pending debounced writes before snapshotting the store so we
  // don't race with their results landing after our own UPDATEs.
  await flushDebounced()
  const { passport, pages, stops, punchSlots, isDirty, dirtyPassport, dirtyPageIds, dirtyStopIds, dirtyPunchIds } =
    usePassportStore.getState()
  if (!passport) return []

  // Dirty filter (see header comment). Snapshot the sets BEFORE writing;
  // edits made mid-save re-mark their rows and keep their own debounced
  // writes, so nothing is lost if the user keeps working.
  const fullSweep =
    isDirty && !dirtyPassport && dirtyPageIds.size === 0 && dirtyStopIds.size === 0 && dirtyPunchIds.size === 0
  const writePassport = fullSweep || dirtyPassport
  const pagesToWrite = fullSweep ? pages : pages.filter((p) => dirtyPageIds.has(p.id))
  const stopsToWrite = fullSweep ? stops : stops.filter((st) => dirtyStopIds.has(st.id))
  // Punch slots — moichido only; empty for persistent passports, so this
  // loop is a no-op for the okuji designer.
  const punchesToWrite = fullSweep ? punchSlots : punchSlots.filter((p) => dirtyPunchIds.has(p.id))

  inc()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const errors: BatchError[] = []

  try {
    if (writePassport) {
    const { error: passportErr } = await updateWithRetry(db, 'passports', {
      title:                  passport.title,
      description:            passport.description,
      cover_emblem:           passport.cover_emblem,
      cover_paper_color:      passport.cover_paper_color,
      cover_bg_color:         passport.cover_bg_color,
      cover_outside_data:     passport.cover_outside_data,
      cover_inside_data:      passport.cover_inside_data,
      expected_spend_tier:    passport.expected_spend_tier,
      expected_spend_note:    passport.expected_spend_note,
      transit_accessible:     passport.transit_accessible,
      wheelchair_accessible:  passport.wheelchair_accessible,
      print_journal_setting:  passport.print_journal_setting,
      // M2 follow-up — per-copy serial display toggle + expiry
      // duration. show_copy_number gates the {{copy_number}} token
      // resolution at render. expiry_duration_days affects FUTURE
      // acquisitions only — existing collector_passports.expires_at
      // is stored concretely so design-side changes never
      // retroactively expire holders.
      show_copy_number:       passport.show_copy_number,
      expiry_duration_days:   passport.expiry_duration_days,
      // M2 — credential type + design-time consumable target.
      // Whole-passport discriminator (persistent | consumable).
      // consumable_target_count is only meaningful on consumable;
      // unset on persistent. Persisted so the M3
      // ensure_collector_passport SECDEF picks up the right value
      // when seeding a holder's first card_instance at acquisition.
      credential_type:         passport.credential_type,
      consumable_target_count: passport.consumable_target_count,
      // moichido card-level punch mark (migration 086).
      punch_type:              passport.punch_type,
      punch_icon:              passport.punch_icon,
      punch_asset_id:          passport.punch_asset_id,
      // Passport-completion prize (migration 098).
      completion_prize_description: passport.completion_prize_description,
      completion_prize_value_cents: passport.completion_prize_value_cents,
      updated_at:             new Date().toISOString(),
    }, 'id', passport.id)
    if (passportErr) {
      console.error('[persist] saveAll passports failed', { id: passport.id, error: passportErr })
      errors.push({ table: 'passports', id: passport.id, message: passportErr.message ?? 'unknown' })
    }
    }

    // Pages — issue updates sequentially through the shared write chain.
    // Parallel writes are what caused the 57014 statement-timeout pile-up:
    // row locks chained behind each other and one would eventually exceed
    // the 8s Supabase timeout. serialize() guarantees only one update is
    // in flight at a time across both saveAll AND the per-mutation
    // debounced writes from updateStop / updatePage / etc.
    for (const page of pagesToWrite) {
      const { error: pageErr } = await updateWithRetry(db, 'passport_pages', {
        section_title:             page.section_title,
        section_subtitle:          page.section_subtitle,
        prize_description:         page.prize_description,
        prize_location_constraint: page.prize_location_constraint,
        background_type:           page.background_type,
        background_color:          page.background_color,
        background_opacity:        page.background_opacity,
        background_image_url:      page.background_image_url,
        custom_background_opacity: page.custom_background_opacity,
        paper_color:               page.paper_color,
        page_order:                page.page_order,
        elements:                  page.elements ?? [],
      }, 'id', page.id)
      if (pageErr) {
        console.error('[persist] saveAll page failed', { id: page.id, error: pageErr })
        errors.push({ table: 'passport_pages', id: page.id, message: pageErr.message ?? 'unknown' })
      }
    }

    for (const stop of stopsToWrite) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = stop
      const { error: stopErr } = await updateWithRetry(db, 'stops', {
        name:               stop.name,
        stop_order:         stop.stop_order,
        learning_objective: stop.learning_objective,
        journal_prompt:     stop.journal_prompt,
        classifiers:        stop.classifiers ?? [],
        grade_levels:       stop.grade_levels ?? [],
        subject_areas:      stop.subject_areas ?? [],
        is_shared:          stop.is_shared ?? false,
        shared_at:          stop.shared_at ?? null,
        // Location / address fields. location_type is retired by
        // migration 046 — the canonical pair below replaces it.
        address_street:     s.address_street,
        address_city:       s.address_city,
        address_state:      s.address_state,
        address_zip:        s.address_zip,
        country:            s.country,
        lat:                stop.lat,
        lng:                stop.lng,
        // Verification — canonical pair drives verification_tier via
        // the migration-046 sync trigger, so we don't send tier here.
        verification_radius_meters:  stop.verification_radius_meters,
        experience_type:             stop.experience_type,
        experience_verification_method: stop.experience_verification_method,
        stamp_icon:         stop.stamp_icon,
        stamp_color:        stop.stamp_color,
        stamp_rotation_min: stop.stamp_rotation_min,
        stamp_rotation_max: stop.stamp_rotation_max,
        stamp_rotation_fixed: stop.stamp_rotation_fixed,
        smudge_intensity:   stop.smudge_intensity,
        stamp_type:         stop.stamp_type,
        stamp_asset_id:     stop.stamp_asset_id,
        box_x:              stop.box_x,
        box_y:              stop.box_y,
        box_width:          stop.box_width,
        box_height:         stop.box_height,
        rotation:           stop.rotation,
        print_include_journal: stop.print_include_journal,
        // Location caption (migration 079) — display choice only; the
        // address_*/lat/lng data is persisted via their own fields.
        location_caption_mode:      s.location_caption_mode,
        location_caption_placement: s.location_caption_placement,
      }, 'id', stop.id)
      if (stopErr) {
        console.error('[persist] saveAll stop failed', { id: stop.id, error: stopErr })
        errors.push({ table: 'stops', id: stop.id, message: stopErr.message ?? 'unknown' })
      }
    }

    // Punch slots (moichido). Only the editable design-time fields —
    // position + order + label. No location/verification fields exist.
    for (const punch of punchesToWrite) {
      const { error: punchErr } = await updateWithRetry(db, 'punch_slots', {
        slot_order: punch.slot_order,
        box_x:      punch.box_x,
        box_y:      punch.box_y,
        box_width:  punch.box_width,
        box_height: punch.box_height,
        rotation:   punch.rotation,
        label:      punch.label,
      }, 'id', punch.id)
      if (punchErr) {
        console.error('[persist] saveAll punch_slot failed', { id: punch.id, error: punchErr })
        errors.push({ table: 'punch_slots', id: punch.id, message: punchErr.message ?? 'unknown' })
      }
    }

    if (errors.length === 0) {
      usePassportStore.getState().setSaveError(null)
      dec()
      // Every successful saveAll writes the full stops set —
      // location fields included — so revalidate the audit
      // surface unconditionally. Fire-and-forget.
      void revalidateLocationAudit().catch(() => {})
    } else {
      const summary = errors.length === 1
        ? `${errors[0].table}: ${errors[0].message}`
        : `${errors.length} writes failed (${errors[0].message})`
      usePassportStore.getState().setSaveError(summary)
      dec()
    }
    return errors
  } catch (err) {
    console.error('[persist] saveAll threw', err)
    const msg = err instanceof Error ? err.message : 'Save failed'
    usePassportStore.getState().setSaveError(msg)
    dec()
    return errors
  }
}
