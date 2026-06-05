/**
 * Server-side resolver for the welcome modal's audience variant.
 *
 * Returns the AudienceKey (`institutional_designer` /
 * `institutional_member` / `individual` / `admin`) plus the
 * institution name to interpolate into the band copy, plus the
 * raw `welcomeSeenAt` so the page can decide whether the modal
 * should auto-open.
 *
 * Variant precedence (top wins):
 *   1. admin                    → profiles.is_platform_admin = true
 *   2. institutional_designer   → member of an institution AND can_design
 *   3. institutional_member     → member of an institution AND NOT can_design
 *   4. individual               → fallback
 *
 * `member of an institution` means EITHER an employee_authorizations
 * row exists for this user OR `institutions.id = user.id` (the
 * institutional-manager case where the user IS the institution).
 *
 * Institution NAME for the band:
 *   - manager  → the row from `institutions` where id = userId
 *   - employee → first row from `institutions` joined via the
 *                user's first employee_authorizations row
 *
 * One small fetch sequence — Promise.all so this runs in parallel
 * with the existing loadDashboard() call from the page.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AudienceKey } from './copy'

export interface WelcomeAudience {
  audience: AudienceKey
  institutionName: string | null
  welcomeSeenAt: string | null
}

export async function resolveWelcomeAudience(
  supabase: SupabaseClient,
  userId: string,
): Promise<WelcomeAudience> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [profileRes, eaRes, mgrRes] = await Promise.all([
    db.from('profiles')
      .select('is_platform_admin, welcome_seen_at')
      .eq('id', userId)
      .single(),
    db.from('employee_authorizations')
      .select('institution_id, can_design')
      .eq('user_id', userId)
      .limit(1),
    db.from('institutions')
      .select('id, name')
      .eq('id', userId)
      .limit(1),
  ])

  const profile = profileRes.data as
    | { is_platform_admin: boolean; welcome_seen_at: string | null }
    | null
  const ea = (eaRes.data ?? []) as
    { institution_id: string; can_design: boolean | null }[]
  const mgr = (mgrRes.data ?? []) as
    { id: string; name: string | null }[]

  const welcomeSeenAt = profile?.welcome_seen_at ?? null

  // 1. Admin wins. Admin band is omitted; the admin's CTAs default
  //    to "Open the designer" + "Explore passports".
  if (profile?.is_platform_admin) {
    return { audience: 'admin', institutionName: null, welcomeSeenAt }
  }

  // 2. Manager: the user IS the institution.
  if (mgr.length > 0) {
    return {
      audience: 'institutional_designer',
      institutionName: mgr[0].name ?? null,
      welcomeSeenAt,
    }
  }

  // 3. Employee: per the user's first EA row. can_design split
  //    chooses the designer-flavored or member-flavored variant.
  if (ea.length > 0) {
    const row = ea[0]
    const isDesigner = row.can_design === true
    // The institution name comes from a second fetch keyed on the
    // EA's institution_id. Skipping it gracefully → band still
    // renders, just without the inserted name.
    const { data: inst } = await db
      .from('institutions')
      .select('name')
      .eq('id', row.institution_id)
      .single()
    const institutionName =
      (inst as { name: string | null } | null)?.name ?? null
    return {
      audience: isDesigner ? 'institutional_designer' : 'institutional_member',
      institutionName,
      welcomeSeenAt,
    }
  }

  // 4. Individual fallback.
  return { audience: 'individual', institutionName: null, welcomeSeenAt }
}
