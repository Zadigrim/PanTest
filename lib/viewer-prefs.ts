// Collector viewer preferences — local (per-device) display toggles for the
// passport book reader. These are NOT part of how a passport is designed in
// the kobo designer; they're personal reader options surfaced in Profile.
// Stored in AsyncStorage (same store the supabase session uses). Defaults
// match the prior always-on behavior so nothing changes until the user opts.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useEffect, useState, useCallback } from 'react'

// How un-earned stamp slots are marked in the reader:
//   'off'  → clean, the passport as designed (no where-to-stamp marker)
//   'ring' → the branded stamp ring at each un-earned slot
//   'box'  → a dashed bounding box outlining each un-earned slot
export type StampGuideMode = 'off' | 'ring' | 'box'

export const STAMP_GUIDE_MODES: StampGuideMode[] = ['off', 'ring', 'box']

export interface ViewerPrefs {
  showToc: boolean
  showExitVisa: boolean
  stampGuide: StampGuideMode
}

const KEYS: Record<keyof ViewerPrefs, string> = {
  showToc: 'okuji.viewer.showToc',
  showExitVisa: 'okuji.viewer.showExitVisa',
  stampGuide: 'okuji.viewer.stampGuide',
}

export const DEFAULT_VIEWER_PREFS: ViewerPrefs = {
  showToc: true,
  showExitVisa: true,
  // Default ON (ring) — preserves the prior always-show-where-to-stamp
  // behavior; collectors who want the clean designed look switch to 'off'.
  stampGuide: 'ring',
}

function parseStampGuide(raw: string | null): StampGuideMode {
  return raw != null && (STAMP_GUIDE_MODES as string[]).includes(raw)
    ? (raw as StampGuideMode)
    : DEFAULT_VIEWER_PREFS.stampGuide
}

export async function getViewerPrefs(): Promise<ViewerPrefs> {
  try {
    const entries = await AsyncStorage.multiGet([KEYS.showToc, KEYS.showExitVisa, KEYS.stampGuide])
    const map = Object.fromEntries(entries)
    return {
      showToc: map[KEYS.showToc] == null ? DEFAULT_VIEWER_PREFS.showToc : map[KEYS.showToc] === 'true',
      showExitVisa: map[KEYS.showExitVisa] == null ? DEFAULT_VIEWER_PREFS.showExitVisa : map[KEYS.showExitVisa] === 'true',
      stampGuide: parseStampGuide(map[KEYS.stampGuide] ?? null),
    }
  } catch {
    return DEFAULT_VIEWER_PREFS
  }
}

export async function setViewerPref<K extends keyof ViewerPrefs>(key: K, value: ViewerPrefs[K]): Promise<void> {
  try { await AsyncStorage.setItem(KEYS[key], String(value)) } catch { /* ignore */ }
}

// Hook for the Profile toggles (and anywhere that wants live prefs). The
// passport viewer reads getViewerPrefs() directly at mount instead, so a
// freshly-opened book reflects the latest choice.
export function useViewerPrefs() {
  const [prefs, setPrefs] = useState<ViewerPrefs>(DEFAULT_VIEWER_PREFS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getViewerPrefs().then((p) => { if (active) { setPrefs(p); setLoaded(true) } })
    return () => { active = false }
  }, [])

  const update = useCallback(async <K extends keyof ViewerPrefs>(key: K, value: ViewerPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    await setViewerPref(key, value)
  }, [])

  return { prefs, loaded, update }
}

// Context so deeply-nested reader components (e.g. StampSlot, several layers
// below the book) can read prefs without threading a prop through every
// intermediate. The viewer wraps its tree in a provider with the prefs it
// loaded at mount; outside a provider (e.g. the designer canvas preview) the
// defaults apply.
export const ViewerPrefsContext = createContext<ViewerPrefs>(DEFAULT_VIEWER_PREFS)
