'use client'

// Tiny localStorage-backed state hooks for designer UI prefs (panel sizes,
// collapsed sections). Initial value is deterministic (so SSR and the first
// client render match — no hydration mismatch); the persisted value is
// loaded in an effect after mount, then written back on every change.
import { useEffect, useState } from 'react'

export function usePersistentNumber(key: string, initial: number) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw != null) {
        const n = Number(raw)
        if (Number.isFinite(n)) setValue(n)
      }
    } catch { /* localStorage unavailable — keep default */ }
  }, [key])
  useEffect(() => {
    try { window.localStorage.setItem(key, String(value)) } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue] as const
}

export function usePersistentBool(key: string, initial: boolean) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === 'true' || raw === 'false') setValue(raw === 'true')
    } catch { /* ignore */ }
  }, [key])
  useEffect(() => {
    try { window.localStorage.setItem(key, String(value)) } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue] as const
}
