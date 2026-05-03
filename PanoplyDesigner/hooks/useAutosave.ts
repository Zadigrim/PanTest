'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/stores/passport-store'

const AUTOSAVE_INTERVAL_MS = 30_000

export function useAutosave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cancelTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const scheduleOrCancel = () => {
      const { isDirty } = usePassportStore.getState()
      if (!isDirty) { cancelTimer(); return }
      if (timerRef.current) return // already scheduled

      timerRef.current = setTimeout(async () => {
        timerRef.current = null
        const { passport, setSaving, markSaved } = usePassportStore.getState()
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
    }

    // Subscribe directly to the store — zero React render-cycle involvement
    const unsub = usePassportStore.subscribe(scheduleOrCancel)

    return () => {
      unsub()
      cancelTimer()
    }
  }, [])
}
