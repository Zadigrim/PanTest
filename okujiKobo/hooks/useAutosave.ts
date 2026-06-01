'use client'

// Designer save model: per-mutation persist (safeUpdate / safeInsert).
//
// Each input commit, drag end, button click, etc. writes its specific
// patch directly. There's no batch autosave job anymore — the previous
// 10-second poll re-serialized the entire passport row + every page +
// every stop on every tick (including the giant cover_outside_data
// jsonb), which bogged the editor down and was redundant with the
// per-mutation writes.
//
// This hook now exposes a single saveNow() that simply waits for any
// in-flight per-mutation saves to drain, plus tab-close / visibility
// listeners that block navigation while writes are pending so the user
// never loses an in-flight save.

import { useEffect, useCallback } from 'react'
import { awaitPending } from '@/lib/design/persist'
import { usePassportStore } from '@/lib/design/passport-store'

export function useAutosave() {
  const saveNow = useCallback(async () => {
    await awaitPending()
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { isSaving, isDirty } = usePassportStore.getState()
      if (isSaving || isDirty) {
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

  return { saveNow }
}
