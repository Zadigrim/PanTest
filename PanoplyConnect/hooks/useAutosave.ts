'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'

const AUTOSAVE_INTERVAL_MS = 30_000

async function persistAll() {
  const { passport, pages, stops, setSaving, markSaved } = usePassportStore.getState()
  if (!passport) return

  setSaving(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  await db
    .from('passports')
    .update({
      title:                  passport.title,
      description:            passport.description,
      cover_emblem:           passport.cover_emblem,
      cover_paper_color:      passport.cover_paper_color,
      cover_bg_color:         passport.cover_bg_color,
      expected_spend_tier:    passport.expected_spend_tier,
      expected_spend_note:    passport.expected_spend_note,
      transit_accessible:     passport.transit_accessible,
      wheelchair_accessible:  passport.wheelchair_accessible,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', passport.id)

  await Promise.all(
    pages.map((page) =>
      db
        .from('passport_pages')
        .update({
          section_title:             page.section_title,
          section_subtitle:          page.section_subtitle,
          prize_description:         page.prize_description,
          prize_location_constraint: page.prize_location_constraint,
        })
        .eq('id', page.id),
    ),
  )

  await Promise.all(
    stops.map((stop) =>
      db
        .from('stops')
        .update({
          name:               stop.name,
          learning_objective: stop.learning_objective,
          journal_prompt:     stop.journal_prompt,
        })
        .eq('id', stop.id),
    ),
  )

  markSaved()
}

export function useAutosave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const { isDirty } = usePassportStore.getState()
    if (!isDirty) return
    await persistAll()
  }, [])

  useEffect(() => {
    const cancelTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const scheduleOrCancel = () => {
      const { isDirty } = usePassportStore.getState()
      if (!isDirty) {
        cancelTimer()
        return
      }
      if (timerRef.current) return

      timerRef.current = setTimeout(async () => {
        timerRef.current = null
        const { isDirty: stillDirty } = usePassportStore.getState()
        if (!stillDirty) return
        await persistAll()
      }, AUTOSAVE_INTERVAL_MS)
    }

    // Subscribe directly to the store — zero React render-cycle involvement
    const unsub = usePassportStore.subscribe(scheduleOrCancel)

    return () => {
      unsub()
      cancelTimer()
    }
  }, [])

  return { saveNow }
}
