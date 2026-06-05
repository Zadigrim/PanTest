/**
 * Stop Library feature flags.
 *
 * Mirror of lib/dashboard/flags.ts but scoped to the Stop Library
 * surface — kept separate so the dashboard module doesn't grow a
 * heterogeneous bag of toggles.
 *
 * Defaults: ALL flags OFF in production. Flip individually via
 * NEXT_PUBLIC_STOPS_FLAG_<NAME>=1 for a local preview.
 */

function envOn(name: string): boolean {
  if (typeof process === 'undefined') return false
  const v = process.env[name]
  return v === '1' || v === 'true'
}

export interface StopFlags {
  /** Stop ratings UI (1-5 stars) — the underlying table
   *  (migration 061) ships dormant. Acknowledgments + the
   *  Used-this badge are the active quality signals; this
   *  flips on only if a stronger signal proves needed at
   *  scale. Flipping it requires building the rating
   *  controls in the drawer + a sort option in the toolbar;
   *  the flag is the gate. */
  showStopRatings: boolean
}

export function getStopFlags(): StopFlags {
  return {
    showStopRatings: envOn('NEXT_PUBLIC_STOPS_FLAG_RATINGS'),
  }
}
