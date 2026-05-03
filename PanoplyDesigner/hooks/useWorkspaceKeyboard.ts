'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/stores/passport-store'

interface Options {
  onSave?: () => void
  onSettings?: () => void
}

export function useWorkspaceKeyboard({ onSave, onSettings }: Options = {}) {
  // Use refs so the effect never needs to re-run when callbacks change
  const onSaveRef = useRef(onSave)
  const onSettingsRef = useRef(onSettings)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { onSettingsRef.current = onSettings }, [onSettings])

  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const removeStop = usePassportStore((s) => s.removeStop)

  useEffect(() => {
    const inTextField = (el: Element | null): boolean =>
      !!el && (
        (el as HTMLElement).tagName === 'INPUT' ||
        (el as HTMLElement).tagName === 'TEXTAREA' ||
        (el as HTMLElement).isContentEditable
      )

    const handler = async (e: KeyboardEvent) => {
      // Cmd/Ctrl shortcuts fire regardless of focus context
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSaveRef.current?.()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        onSettingsRef.current?.()
        return
      }

      // For everything else, bail out if the user is editing text.
      // Check both e.target and document.activeElement — they can diverge
      // during React re-renders in concurrent mode.
      if (inTextField(e.target as Element) || inTextField(document.activeElement)) return

      if (e.key === 'Escape') {
        setSelectedStop(null)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Access current store state directly — no stale closure
        const { selectedStopId, stops } = usePassportStore.getState()
        if (!selectedStopId) return
        const stop = stops.find((s) => s.id === selectedStopId)
        if (!stop) return
        if (!confirm(`Delete stop "${stop.name}"?`)) return
        const supabase = createClient()
        await supabase.from('stops').delete().eq('id', selectedStopId)
        removeStop(selectedStopId)
        setSelectedStop(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSelectedStop, removeStop]) // stable Zustand actions only
}
