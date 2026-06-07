/**
 * Free-tier trial-limit enforcement (DEC-03 / BLD-06).
 *
 * Limits:
 *   - 3 personal passports max (creator_id = user.id AND
 *     proprietor_id IS NULL)
 *   - 12 pages per personal passport max
 *
 * Exemptions (any one is sufficient):
 *   - platform admin
 *   - active Pro subscription (profiles.pro_status = 'active')
 *   - active Studio subscription (profiles.studio_status = 'active')
 *   - institution-owned passport (proprietor_id IS NOT NULL — those
 *     count against the institution, not the user; the institution
 *     itself isn't subject to the trial cap)
 *   - employee with can_design at the proprietor institution
 *     (institutional context — they aren't the personal owner)
 *
 * Why app-layer (not a Postgres CHECK / trigger):
 *   - Migration directories are in the CLAUDE.md hard-constraint
 *     freeze list during the pending Play submission.
 *   - The tier-exemption logic involves multiple table reads
 *     (profiles for pro/studio, employee_authorizations for
 *     institutional path); doing it in a trigger would be expensive.
 *   - Trigger is the long-term hardening (Phase 2 note in
 *     docs/shuin-transition.md). For now: enforce at the route
 *     layer + surface a counter in the UI.
 *
 * The two trial-counter routes:
 *   - POST /api/design/create     → checkPassportCap before INSERT
 *   - POST /api/passport_pages    → checkPageCap before INSERT
 *
 * Both call this helper. The /program Overview surface reads the
 * counter via getTrialUsage().
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const TRIAL_PASSPORT_CAP = 3
export const TRIAL_PAGE_CAP     = 12

export interface TrialUsage {
  /** True when the caller is exempt from trial caps for any reason. */
  exempt: boolean
  /** Why exempt — useful for the UI when surfacing the counter. */
  exemptReason: 'admin' | 'pro' | 'studio' | null
  /** How many personal passports the caller already owns. */
  passportsUsed: number
  /** Cap (3). Stable export for the UI to render N / cap. */
  passportsCap: number
  /** Whether the caller can still create another personal passport. */
  canCreatePassport: boolean
}

/**
 * Reads the caller's trial-counter state. Used by /program's
 * Overview surface + by /api/design/create's pre-INSERT gate.
 */
export async function getTrialUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  userId: string,
): Promise<TrialUsage> {
  // Admin first — bypasses every cap (CLAUDE.md invariant #4).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin === true) {
    return {
      exempt: true, exemptReason: 'admin',
      passportsUsed: 0, passportsCap: TRIAL_PASSPORT_CAP, canCreatePassport: true,
    }
  }

  // Pro / Studio exemption — read in one round-trip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prof } = await (supabase as any)
    .from('profiles')
    .select('pro_status, pro_expires_at, studio_status, studio_expires_at')
    .eq('id', userId)
    .maybeSingle()

  const isStudio = activeAndUnexpired(prof?.studio_status, prof?.studio_expires_at)
  const isPro    = activeAndUnexpired(prof?.pro_status, prof?.pro_expires_at)
  const exemptReason: TrialUsage['exemptReason'] =
    isStudio ? 'studio' : isPro ? 'pro' : null

  // Personal-passport count — institutional passports do NOT count
  // against the personal cap (the institution owns them, not the
  // user). Filter proprietor_id IS NULL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('passports')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', userId)
    .is('proprietor_id', null)

  const passportsUsed = count ?? 0
  const exempt = exemptReason != null
  return {
    exempt,
    exemptReason,
    passportsUsed,
    passportsCap: TRIAL_PASSPORT_CAP,
    canCreatePassport: exempt || passportsUsed < TRIAL_PASSPORT_CAP,
  }
}

/**
 * Page-cap check for an individual passport. Returns the cap result
 * + the current count so the route can return both to the client
 * (so the UI can echo "you used 12 of 12 on that passport").
 *
 * Personal passports only — passes always for institution-owned
 * passports (proprietor_id IS NOT NULL is the exemption signal,
 * resolved at the route level by selecting proprietor_id before
 * calling this).
 */
export async function getPageUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  passportId: string,
  callerIsExemptOrInstitutional: boolean,
): Promise<{
  pagesUsed: number
  pagesCap: number
  canAddPage: boolean
}> {
  if (callerIsExemptOrInstitutional) {
    return { pagesUsed: 0, pagesCap: TRIAL_PAGE_CAP, canAddPage: true }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('passport_pages')
    .select('id', { count: 'exact', head: true })
    .eq('passport_id', passportId)
  const pagesUsed = count ?? 0
  return {
    pagesUsed,
    pagesCap: TRIAL_PAGE_CAP,
    canAddPage: pagesUsed < TRIAL_PAGE_CAP,
  }
}

function activeAndUnexpired(status: string | null | undefined, expiresAt: string | null | undefined): boolean {
  if (status !== 'active') return false
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}
