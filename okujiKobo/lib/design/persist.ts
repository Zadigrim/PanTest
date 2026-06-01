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

function dec() {
  inflight = Math.max(0, inflight - 1)
  if (inflight === 0) {
    // Only mark saved if no failures are still outstanding in the retry
    // queue. Otherwise the indicator would falsely flip to "Saved" while
    // pending failed writes still need attention.
    if (retryQueue.length === 0 && !usePassportStore.getState().saveError) {
      usePassportStore.getState().markSaved()
    } else {
      // Counter zero but errors remain — still clear isSaving so the
      // indicator can show "Save failed" instead of "Saving…".
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

// Retry queue. Each failed safeUpdate / safeInsert is pushed here so the
// SaveIndicator's Retry button can replay them. Without this the button
// is a no-op: the failed write's caller has already moved on (the user
// blurred an input, clicked Done, etc.) so there's nothing local for
// Retry to re-trigger.
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

/** Replays every write that previously failed. Call from the Retry button. */
export async function retryFailed(): Promise<void> {
  if (retryQueue.length === 0) {
    // Nothing queued — just clear the error banner.
    usePassportStore.getState().setSaveError(null)
    if (inflight === 0) usePassportStore.getState().markSaved()
    return
  }
  const items = retryQueue.splice(0)
  // Clear before replaying so a fresh failure's error message is the one
  // that shows up, not a stale one from before Retry was clicked.
  usePassportStore.getState().setSaveError(null)
  for (const item of items) {
    if (item.kind === 'update') {
      await safeUpdate(item.table, item.patch, item.eqColumn, item.eqValue)
    } else {
      await safeInsert(item.table, item.row, item.selectClause)
    }
  }
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
