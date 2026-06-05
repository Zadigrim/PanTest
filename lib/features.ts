/**
 * Feature flags for the collector mobile app.
 *
 * Build-time constants — no runtime config, no remote source. To
 * ship a feature dark, default it to `false` here and flip to
 * `true` when ready. Each flag carries an inline note on what the
 * surface looks like when off.
 */

export const FEATURES = {
  /**
   * "Nearby" geographic passport discovery on the Discover tab.
   *
   * When `true`: the Nearby segment of the Discover tab queries
   * find_passports_nearby() with an ephemeral GPS reading and
   * renders passport cards ranked by nearest-stop distance.
   *
   * When `false`: the Nearby segment renders a quiet "Coming
   * soon" card; the Catalogue segment is unaffected and the
   * Discover tab continues to function. The RPC + permissions
   * are still in place, so flipping this on is a one-line
   * change with no migration / native rebuild required.
   *
   * Default `true` per the build-now-ship-quietly intent — flip
   * to `false` here if density isn't ready for visible launch.
   */
  NEARBY_DISCOVERY: true,
} as const

export type FeatureKey = keyof typeof FEATURES
