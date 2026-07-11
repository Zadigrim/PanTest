import { Dimensions } from 'react-native'

// Tablet detection: smallest-width >= 600dp — the canonical Android sw600dp
// cutoff. A 7"+ tablet is >= 600dp on its short edge; phones fall under it.
// We read the raw device dimensions (not a live hook) because this drives a
// one-time native orientation decision at startup, not a reactive layout.
export function isTabletDevice(): boolean {
  const { width, height } = Dimensions.get('window')
  return Math.min(width, height) >= 600
}

// The native module surface we use — declared locally so this file type-checks
// before `expo install expo-screen-orientation` has run, and so a device that
// hasn't been rebuilt with the module linked degrades gracefully instead of
// crashing.
type ScreenOrientationModule = {
  lockAsync: (orientationLock: number) => Promise<unknown>
  OrientationLock: { PORTRAIT_UP: number }
}

// Phones stay pinned to portrait exactly as before; tablets rotate freely
// (app.json is set to "default", i.e. all orientations, and we only re-lock on
// phones). Lazy-required + try/catch so the bundle still runs if the module
// isn't linked yet.
export async function applyStartupOrientation(): Promise<void> {
  if (isTabletDevice()) return // tablet: allow all orientations
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScreenOrientation = require('expo-screen-orientation') as ScreenOrientationModule
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
  } catch {
    // Native module absent (pre-rebuild) — phone falls back to the app.json
    // orientation until the next native build includes expo-screen-orientation.
  }
}
