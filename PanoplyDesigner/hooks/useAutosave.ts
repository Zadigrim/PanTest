'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/stores/passport-store'

const AUTOSAVE_INTERVAL_MS = 30_000

/**
 * Autosaves the passport title/description every 30s if dirty.
 * Individual field changes (stops, pages) persist immediately via inline onBlur calls.
 * This hook handles the passport-level fields as a safety net.
 */
export function useAutosave() {
  const isDirty = usePassportStore((s) => s.isDirty)
  const setSaving = usePassportStore((s) => s.setSaving)
  const markSaved = usePassportStore((s) => s.markSaved)
  const passportRef = useRef(usePassportStore.getState().passport)

  useEffect(() => {
    const unsub = usePassportStore.subscribe((s) => {
      passportRef.current = s.passport
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!isDirty) return

    const timer = setTimeout(async () => {
      const passport = passportRef.current
      if (!passport) return
      setSaving(true)
      const supabase = createClient()
      await supabase
        .from('passports')
        .update({
          title: passport.title,
          description: passport.description,
          cover_emblem: passport.cover_emblem,
          cover_paper_color: passport.cover_paper_color,
          cover_bg_color: passport.cover_bg_color,
          expected_spend_tier: passport.expected_spend_tier,
          expected_spend_note: passport.expected_spend_note,
          transit_accessible: passport.transit_accessible,
          wheelchair_accessible: passport.wheelchair_accessible,
          updated_at: new Date().toISOString(),
        })
        .eq('id', passport.id)
      markSaved()
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [isDirty, setSaving, markSaved])
}
