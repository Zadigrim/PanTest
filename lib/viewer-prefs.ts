// Collector viewer preferences — local (per-device) display toggles for the
// passport book reader. These are NOT part of how a passport is designed in
// the kobo designer; they're personal reader options surfaced in Profile.
// Stored in AsyncStorage (same store the supabase session uses). Defaults
// match the prior always-on behavior so nothing changes until the user opts.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState, useCallback } from 'react'

export interface ViewerPrefs {
  showToc: boolean
  showExitVisa: boolean
}

const KEYS: Record<keyof ViewerPrefs, string> = {
  showToc: 'okuji.viewer.showToc',
  showExitVisa: 'okuji.viewer.showExitVisa',
}

export const DEFAULT_VIEWER_PREFS: ViewerPrefs = { showToc: true, showExitVisa: true }

export async function getViewerPrefs(): Promise<ViewerPrefs> {
  try {
    const entries = await AsyncStorage.multiGet([KEYS.showToc, KEYS.showExitVisa])
    const map = Object.fromEntries(entries)
    return {
      showToc: map[KEYS.showToc] == null ? DEFAULT_VIEWER_PREFS.showToc : map[KEYS.showToc] === 'true',
      showExitVisa: map[KEYS.showExitVisa] == null ? DEFAULT_VIEWER_PREFS.showExitVisa : map[KEYS.showExitVisa] === 'true',
    }
  } catch {
    return DEFAULT_VIEWER_PREFS
  }
}

export async function setViewerPref(key: keyof ViewerPrefs, value: boolean): Promise<void> {
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

  const update = useCallback(async (key: keyof ViewerPrefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    await setViewerPref(key, value)
  }, [])

  return { prefs, loaded, update }
}
