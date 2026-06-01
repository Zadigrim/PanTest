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

function describeError(err: { message?: string | null; code?: string | null } | null | undefined): string {
  if (!err) return 'Save failed'
  return err.message?.trim() ? err.message : `Save failed${err.code ? ` (${err.code})` : ''}`
}

// In-flight counter. Lets the SaveIndicator reflect actual write activity
// instead of needing a separate polling loop. Replaces the old 10s
// useAutosave batch which re-serialized the whole passport row on every
// tick and made the editor feel sluggish.
let inflight = 0
const pendingResolvers: Array<() => void> = []

function inc() {
  inflight++
  usePassportStore.getState().setSaving(true)
}

function dec(success: boolean) {
  inflight = Math.max(0, inflight - 1)
  if (inflight === 0) {
    if (success) {
      usePassportStore.getState().markSaved()
    } else {
      // setSaveError already clears isSaving; nothing else to do.
    }
    while (pendingResolvers.length) pendingResolvers.shift()?.()
  }
}

/** Resolves when all currently-running safeUpdate / safeInsert calls finish. */
export function awaitPending(): Promise<void> {
  if (inflight === 0) return Promise.resolve()
  return new Promise<void>((resolve) => pendingResolvers.push(resolve))
}

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
      usePassportStore.getState().setSaveError(describeError(error))
      dec(false)
      return false
    }
    usePassportStore.getState().setSaveError(null)
    dec(true)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    usePassportStore.getState().setSaveError(msg)
    dec(false)
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
      usePassportStore.getState().setSaveError(describeError(error))
      dec(false)
      return null
    }
    usePassportStore.getState().setSaveError(null)
    dec(true)
    return (data ?? null) as T | null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    usePassportStore.getState().setSaveError(msg)
    dec(false)
    return null
  }
}
