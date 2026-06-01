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

export async function safeUpdate(
  table: string,
  patch: Record<string, unknown>,
  eqColumn: string,
  eqValue: string | number,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const { error } = await db.from(table).update(patch).eq(eqColumn, eqValue)
  if (error) {
    usePassportStore.getState().setSaveError(describeError(error))
    return false
  }
  usePassportStore.getState().setSaveError(null)
  return true
}

export async function safeInsert<T = unknown>(
  table: string,
  row: Record<string, unknown>,
  selectClause?: string,
): Promise<T | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const q = db.from(table).insert(row)
  const { data, error } = selectClause ? await q.select(selectClause).single() : await q
  if (error) {
    usePassportStore.getState().setSaveError(describeError(error))
    return null
  }
  usePassportStore.getState().setSaveError(null)
  return (data ?? null) as T | null
}
