'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/stores/passport-store'

interface Options {
  onSave?: () => void
  onSettings?: () => void
}

/**
 * Keyboard shortcuts for the workspace:
 * - Cmd/Ctrl+S → trigger save
 * - Escape → deselect stop
 * - Delete / Backspace (when stop selected) → delete stop
 */
export function useWorkspaceKeyboard({ onSave, onSettings }: Options = {}) {
  const selectedStopId = usePassportStore((s) => s.selectedStopId)
  const setSelectedStop = usePassportStore((s) => s.setSelectedStop)
  const removeStop = usePassportStore((s) => s.removeStop)
  const stops = usePassportStore((s) => s.stops)

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Cmd/Ctrl+S — save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave?.()
        return
      }

      // Cmd/Ctrl+, — settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        onSettings?.()
        return
      }

      // Escape — deselect
      if (e.key === 'Escape') {
        setSelectedStop(null)
        return
      }

      // Delete / Backspace — delete selected stop (not when typing in a field)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && selectedStopId) {
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
  }, [selectedStopId, stops, setSelectedStop, removeStop, onSave, onSettings])
}
