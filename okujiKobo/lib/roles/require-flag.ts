/**
 * Capability-flag enforcement helper — single source of truth for
 * "does the caller hold flag X at institution Y."
 *
 * Used by every server route + every server component that needs to
 * gate institution-scoped work. The helper centralizes:
 *   - the platform-admin bypass (single mechanism per CLAUDE.md
 *     governing invariant #4 — is_platform_admin RPC is the only
 *     admin gate)
 *   - the employee_authorizations lookup
 *   - active-institution-context fallback (when caller omits an
 *     explicit institutionId, the helper reads the active-institution
 *     cookie written by RoleSwitcher; null → no flag check possible
 *     and the helper returns false for non-admins)
 *
 * Scope-qualifier shape: FlagScope carries an optional credentialType
 * field that the helper IGNORES today. Designed for the future
 * moichido (consumable-credential) work — when that lands, the
 * helper resolves type-aware authorization without refactoring any
 * call site. Phase 1 builds and uses only the unscoped variant.
 *
 * Server-only: imports server-side Supabase client + cookies via
 * the activeInstitutionId() reader. Don't import from a client
 * component.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveInstitutionCookie } from '@/app/actions/role'

export type CapabilityFlag =
  | 'can_design'
  | 'can_manage_employees'
  | 'can_view_analytics'
  | 'can_manage_billing'
  | 'can_verify'
  | 'can_distribute_prizes'

/**
 * Scope qualifier. Today the helper consults only `flag`; the
 * `credentialType` field is reserved for moichido and is silently
 * ignored. When that ships, the helper grows a join against a
 * future credential-type-authorization table without changing
 * any caller's signature.
 */
export interface FlagScope {
  flag: CapabilityFlag
  /** Reserved for moichido. IGNORED in Phase 1. */
  credentialType?: 'passport' | 'punch_card'
}

/**
 * Returns true when the caller is permitted under `scope` for the
 * given institution context:
 *   1. is_platform_admin always passes (platform admins bypass
 *      every gate per CLAUDE.md invariant #4).
 *   2. Otherwise, requires an employee_authorizations row at
 *      `institutionId` with `scope.flag = true`.
 *
 * Pass `institutionId = null` to opt into the active-institution
 * cookie fallback. The fallback resolves to the cookie value if
 * present; null cookie → returns false (non-admin caller has no
 * institutional context).
 *
 * Returns false on: missing user (caller checks auth before
 * calling), null institutionId without cookie, denied lookup.
 * Routes that 403 on false get a clean three-line gate.
 */
export async function callerHasFlag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  institutionId: string | null,
  scope: FlagScope,
): Promise<boolean> {
  // (1) platform-admin bypass
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin === true) return true

  // (2) resolve institution context
  let effectiveInstitutionId = institutionId
  if (!effectiveInstitutionId) {
    effectiveInstitutionId = await getActiveInstitutionCookie()
  }
  if (!effectiveInstitutionId) return false

  // (3) get the auth context's user id, then look up the row
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: authz } = await (supabase as any)
    .from('employee_authorizations')
    .select(scope.flag)
    .eq('user_id', user.id)
    .eq('institution_id', effectiveInstitutionId)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(authz as any)?.[scope.flag]
}

/**
 * Convenience wrapper for institution-owned passport mutations.
 * Pattern: a route loads the passport, learns its proprietor_id,
 * and gates on can_design IF proprietor_id is set. Personal
 * passports (proprietor_id IS NULL) keep the creator-or-admin
 * path the route already had.
 *
 * Returns:
 *   - 'admin'      — platform admin, bypasses every check
 *   - 'creator'    — caller is the passport's creator_id
 *   - 'employee'   — caller has can_design at the institution
 *                    that owns the passport
 *   - 'denied'     — none of the above; route should 403
 */
export async function authorizePassportMutation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  passport: { creator_id: string; proprietor_id: string | null },
  callerUserId: string,
): Promise<'admin' | 'creator' | 'employee' | 'denied'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin === true) return 'admin'

  if (passport.creator_id === callerUserId) return 'creator'

  // Personal passport without institutional ownership — only the
  // creator or an admin can mutate.
  if (!passport.proprietor_id) return 'denied'

  const ok = await callerHasFlag(supabase, passport.proprietor_id, { flag: 'can_design' })
  return ok ? 'employee' : 'denied'
}
