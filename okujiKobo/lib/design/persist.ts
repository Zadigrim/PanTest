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

function inc() {
  inflight++
  usePassportStore.getState().setSaving(true)
}

function dec() {
  inflight = Math.max(0, inflight - 1)
  if (inflight === 0) {
    if (retryQueue.length === 0 && !usePassportStore.getState().saveError) {
      usePassportStore.getState().markSaved()
    } else {
      usePassportStore.getState().setSaving(false)
    }
    while (pendingResolvers.length) pendingResolvers.shift()?.()
  }
}

/** Resolves when all currently-running safeUpdate / safeInsert calls finish. */
export function awaitPending(): Promise<void> {
  if (inflight === 0) return Promise.resolve()
  return new Promise<void>((resolve) => pendingResolvers.push(resolve))
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  try {
    const { error } = await db.from(table).update(patch).eq(eqColumn, eqValue)
    if (error) {
      console.error('[persist] safeUpdate failed', { table, eqColumn, eqValue, patch, error })
      usePassportStore.getState().setSaveError(describeError(error))
      retryQueue.push({ kind: 'update', table, patch, eqColumn, eqValue })
      dec()
      return false
    }
    dec()
    return true
  } catch (err) {
    console.error('[persist] safeUpdate threw', { table, eqColumn, eqValue, patch, err })
    const msg = err instanceof Error ? err.message : 'Save failed'
    usePassportStore.getState().setSaveError(msg)
    retryQueue.push({ kind: 'update', table, patch, eqColumn, eqValue })
    dec()
    return false
  }
}

export async function safeInsert<T = unknown>(
  table: string,
  row: Record<string, unknown>,
  selectClause?: string,
): Promise<T | null> {
  inc()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  try {
    const q = db.from(table).insert(row)
    const { data, error } = selectClause ? await q.select(selectClause).single() : await q
    if (error) {
      console.error('[persist] safeInsert failed', { table, row, error })
      usePassportStore.getState().setSaveError(describeError(error))
      retryQueue.push({ kind: 'insert', table, row, selectClause })
      dec()
      return null
    }
    dec()
    return (data ?? null) as T | null
  } catch (err) {
    console.error('[persist] safeInsert threw', { table, row, err })
    const msg = err instanceof Error ? err.message : 'Save failed'
    usePassportStore.getState().setSaveError(msg)
    retryQueue.push({ kind: 'insert', table, row, selectClause })
    dec()
    return null
  }
}

// ── Explicit save ────────────────────────────────────────────────────────────
//
// The designer no longer auto-persists field edits or drag changes — every
// in-place mutation just updates the local store and marks isDirty. The
// user (or handleBack) calls saveAll() to write everything in one pass.
//
// saveAll writes the FULL editable surface for each entity even if only one
// field changed. Cheaper than tracking a diff, and the row-level lock is
// held only as long as the single UPDATE takes.

interface BatchError { table: string; id: string; message: string }

export async function saveAll(): Promise<BatchError[]> {
  const { passport, pages, stops } = usePassportStore.getState()
  if (!passport) return []

  inc()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const errors: BatchError[] = []

  try {
    const { error: passportErr } = await db
      .from('passports')
      .update({
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
        updated_at:             new Date().toISOString(),
      })
      .eq('id', passport.id)
    if (passportErr) {
      console.error('[persist] saveAll passports failed', { id: passport.id, error: passportErr })
      errors.push({ table: 'passports', id: passport.id, message: passportErr.message ?? 'unknown' })
    }

    // Pages — issue updates sequentially. Parallel writes are what caused
    // the 57014 statement-timeout pile-up: row locks chained behind each
    // other and one would eventually exceed the 8s Supabase timeout.
    // Sequential is slower but reliable.
    for (const page of pages) {
      const { error: pageErr } = await db
        .from('passport_pages')
        .update({
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
        })
        .eq('id', page.id)
      if (pageErr) {
        console.error('[persist] saveAll page failed', { id: page.id, error: pageErr })
        errors.push({ table: 'passport_pages', id: page.id, message: pageErr.message ?? 'unknown' })
      }
    }

    for (const stop of stops) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = stop
      const { error: stopErr } = await db
        .from('stops')
        .update({
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
        })
        .eq('id', stop.id)
      if (stopErr) {
        console.error('[persist] saveAll stop failed', { id: stop.id, error: stopErr })
        errors.push({ table: 'stops', id: stop.id, message: stopErr.message ?? 'unknown' })
      }
    }

    if (errors.length === 0) {
      usePassportStore.getState().setSaveError(null)
      dec()
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
