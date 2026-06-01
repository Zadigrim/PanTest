'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'

// Periodic check: every 10s, if anything is dirty, save it. Previously
// 30s, which lost up to 30s of changes when the user navigated away or
// closed the tab. 10s keeps the worst-case loss small while still
// coalescing rapid edits into a single write. Backed up by a navigate
// flush in WorkspaceClient.handleBack() and beforeunload/visibility
// listeners below, so backing out within the window doesn't lose work.
const AUTOSAVE_INTERVAL_MS = 10_000

interface BatchError { table: string; id: string; message: string }

// Runs every batched save. Each table-write is awaited and its error
// destructured; failures are collected into BatchError[] so the user
// sees a real "Save failed — retry" instead of a fake "Saved ✓".
async function persistAll(): Promise<BatchError[]> {
  const { passport, pages, stops, setSaving } = usePassportStore.getState()
  if (!passport) return []

  setSaving(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any
  const errors: BatchError[] = []

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
      updated_at:             new Date().toISOString(),
    })
    .eq('id', passport.id)
  if (passportErr) errors.push({ table: 'passports', id: passport.id, message: passportErr.message ?? 'unknown' })

  const pageResults = await Promise.all(
    pages.map((page) =>
      db
        .from('passport_pages')
        .update({
          section_title:             page.section_title,
          section_subtitle:          page.section_subtitle,
          prize_description:         page.prize_description,
          prize_location_constraint: page.prize_location_constraint,
          elements:                  page.elements ?? [],
        })
        .eq('id', page.id),
    ),
  )
  pageResults.forEach((r, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (r as any).error
    if (err) errors.push({ table: 'passport_pages', id: pages[i].id, message: err.message ?? 'unknown' })
  })

  const stopResults = await Promise.all(
    stops.map((stop) =>
      db
        .from('stops')
        .update({
          name:               stop.name,
          learning_objective: stop.learning_objective,
          journal_prompt:     stop.journal_prompt,
          classifiers:        stop.classifiers ?? [],
          grade_levels:       stop.grade_levels ?? [],
          subject_areas:      stop.subject_areas ?? [],
          is_shared:          stop.is_shared ?? false,
          shared_at:          stop.shared_at ?? null,
        })
        .eq('id', stop.id),
    ),
  )
  stopResults.forEach((r, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = (r as any).error
    if (err) errors.push({ table: 'stops', id: stops[i].id, message: err.message ?? 'unknown' })
  })

  return errors
}

// Single-flight + queue: if a save is in flight when another is requested,
// queue exactly one follow-up so the latest store state is written.
let inflight: Promise<BatchError[]> | null = null
let queued = false

async function runPersist(): Promise<BatchError[]> {
  if (inflight) {
    queued = true
    return inflight
  }
  inflight = persistAll()
  try {
    const errs = await inflight
    if (errs.length === 0) {
      usePassportStore.getState().markSaved()
    } else {
      // Surface first error in the indicator; full details logged.
      console.error('autosave failures:', errs)
      const summary = errs.length === 1
        ? `${errs[0].table}: ${errs[0].message}`
        : `${errs.length} writes failed (${errs[0].message})`
      usePassportStore.getState().setSaveError(summary)
    }
    return errs
  } catch (err) {
    // A thrown Supabase / network exception (not just a result.error)
    // used to leave isSaving=true forever — the indicator would show
    // "Saving…" indefinitely. Treat it the same as a batch failure.
    console.error('autosave threw:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    usePassportStore.getState().setSaveError(msg)
    return []
  } finally {
    inflight = null
    if (queued) {
      queued = false
      void runPersist()
    }
  }
}

export function useAutosave() {
  const saveNow = useCallback(async () => {
    const { isDirty } = usePassportStore.getState()
    if (!isDirty) return
    await runPersist()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const { isDirty } = usePassportStore.getState()
      if (isDirty) void runPersist()
    }, AUTOSAVE_INTERVAL_MS)

    // Flush in-flight work on tab close / hide so backing out inside the
    // 10s window doesn't lose changes.
    const handleBeforeUnload = () => {
      const { isDirty } = usePassportStore.getState()
      if (isDirty) void runPersist()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const { isDirty } = usePassportStore.getState()
        if (isDirty) void runPersist()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return { saveNow }
}
