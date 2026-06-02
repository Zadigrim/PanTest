'use client'

// Designer save model — three layers:
//
//   1. Per-mutation debounced persists in the Zustand store actions
//      (passport-store.ts). Every updatePassport / updatePage / updateStop
//      / updateElement / addElement / removeElement / reorderPages call
//      schedules a coalesced write to the matching DB row. That covers
//      form-field edits, canvas drags, cover edits, and image position /
//      scale / opacity drags all at once.
//
//   2. The manual Save button (WorkspaceClient handleSave) calls saveAll()
//      for an instant flush + whole-passport sweep. saveAll itself runs
//      flushDebounced() first so it doesn't race with pending timers.
//
//   3. This hook — the safety-net backstop. Once every AUTOSAVE_INTERVAL_MS,
//      if the store is still dirty and not already saving, flush pending
//      debounces and then run saveAll() as a last resort. Catches the case
//      where someone adds a new mutating action but forgets to wire the
//      debouncedUpdate, so isDirty=true but no per-mutation persist was
//      ever scheduled.
//
// The old 10s setInterval autosave that re-serialized the entire passport
// every tick (which caused the 30f80e1 loop) is NOT what's running here.
// This interval is gated on (isDirty && !isSaving) and uses the in-flight
// counter from persist.ts; concurrent invocations short-circuit cleanly.

import { useEffect, useCallback } from 'react'
import {
  awaitPending,
  flushDebounced,
  saveAll,
  pendingDebouncedCount,
} from '@/lib/design/persist'
import { usePassportStore } from '@/lib/design/passport-store'

const AUTOSAVE_INTERVAL_MS = 30_000

export function useAutosave() {
  const saveNow = useCallback(async () => {
    await awaitPending()
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { isSaving, isDirty } = usePassportStore.getState()
      if (isSaving || isDirty || pendingDebouncedCount() > 0) {
        // Standard "prevent navigation" hint. Modern browsers ignore the
        // string and show their own message, but setting returnValue is
        // still required to trigger the confirm dialog.
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const { isDirty, isSaving } = usePassportStore.getState()
      // Nothing to do or a save is already running — skip this tick.
      // The next tick will retry; we never pile up concurrent saveAlls.
      if (!isDirty || isSaving) return
      void (async () => {
        await flushDebounced()
        const stillDirty = usePassportStore.getState().isDirty
        if (stillDirty) await saveAll()
      })()
    }, AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return { saveNow }
}
