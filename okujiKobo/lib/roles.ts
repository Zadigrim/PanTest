import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OkujiKoboRole =
  | 'individual_creator'
  | 'institutional_manager'
  | 'institutional_employee'
  | 'designer'
  | 'platform_admin'

export interface RoleContext {
  roles: OkujiKoboRole[]
  activeRole: OkujiKoboRole
  institutions: { id: string; name: string; institution_type: string | null }[]
}

// ─── detectRoles ──────────────────────────────────────────────────────────────

export async function detectRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleContext> {
  const roles: OkujiKoboRole[] = []
  const institutions: RoleContext['institutions'] = []

  // ── 1. profiles.role + profiles.connect_roles + is_platform_admin RPC ───────
  const [profileResult, adminResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, connect_roles')
      .eq('id', userId)
      .single(),
    // Use SECURITY DEFINER RPC — reads is_platform_admin inside PostgreSQL,
    // unaffected by PostgREST schema cache staleness on the column.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('is_platform_admin'),
  ])

  const profile = profileResult.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdminRpc = (adminResult as any).data

  if (isAdminRpc === true) {
    roles.push('platform_admin')
  }

  if (profile) {
    // 'creator' in profiles.role maps to 'individual_creator'
    if (profile.role === 'creator') {
      roles.push('individual_creator')
    }
    // connect_roles is an array of additional OkujiKoboRole values
    const connectRoles = (profile.connect_roles ?? []) as OkujiKoboRole[]
    for (const r of connectRoles) {
      if (!roles.includes(r)) {
        roles.push(r)
      }
    }
  }

  // ── 2. employee_authorizations → institutional_employee ───────────────────
  const { data: employeeAuth } = await supabase
    .from('employee_authorizations')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (employeeAuth && employeeAuth.length > 0) {
    if (!roles.includes('institutional_employee')) {
      roles.push('institutional_employee')
    }
  }

  // ── 3. institutions where id = userId → institutional_manager ─────────────
  const { data: managedInstitutions } = await supabase
    .from('institutions')
    .select('id, name, institution_type')
    .eq('id', userId)

  if (managedInstitutions && managedInstitutions.length > 0) {
    if (!roles.includes('institutional_manager')) {
      roles.push('institutional_manager')
    }
    for (const inst of managedInstitutions) {
      institutions.push({
        id: inst.id,
        name: inst.name,
        institution_type: (inst as Record<string, unknown>).institution_type as string | null ?? null,
      })
    }
  }

  // ── Fallback: every authenticated user is at minimum an individual_creator ─
  if (roles.length === 0) {
    roles.push('individual_creator')
  }

  // ── activeRole: prefer institutional_manager, then individual_creator, etc. ─
  const ROLE_PRIORITY: OkujiKoboRole[] = [
    'platform_admin',
    'institutional_manager',
    'individual_creator',
    'designer',
    'institutional_employee',
  ]

  const activeRole =
    ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0]

  return { roles, activeRole, institutions }
}

// ─── Role display labels ──────────────────────────────────────────────────────

export const ROLE_LABELS: Record<OkujiKoboRole, string> = {
  individual_creator:    'Creator',
  institutional_manager: 'Institution Manager',
  institutional_employee:'Employee',
  designer:              'Designer',
  platform_admin:        'Okuji Admin',
}

// ─── Subscription tier helpers (Studio / Pro) ─────────────────────────────────
//
// migration 035 added studio_status / studio_source / studio_expires_at and
// the parallel pro_* columns on profiles. The comp grant UI at
// /access/comp-subscriptions writes these via the migration-036 trigger.
// These helpers are the single source of truth for "is this user effectively
// Studio (or Pro) right now" — everywhere that needs to gate by tier should
// call isStudio/isPro and never re-implement the status logic inline.
//
// Source ('paid' vs 'comp') does NOT change eligibility; the comp trigger
// sets source='comp' and status='active' so a comp user is indistinguishable
// from a paid user from a privileges standpoint.

export interface SubscriptionFields {
  studio_status?: string | null
  studio_source?: string | null
  studio_expires_at?: string | null
  pro_status?: string | null
  pro_source?: string | null
  pro_expires_at?: string | null
}

function activeAndUnexpired(status: string | null | undefined, expiresAt: string | null | undefined): boolean {
  if (status !== 'active') return false
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now()
}

export function isStudio(profile: SubscriptionFields | null | undefined): boolean {
  if (!profile) return false
  return activeAndUnexpired(profile.studio_status, profile.studio_expires_at)
}

export function isPro(profile: SubscriptionFields | null | undefined): boolean {
  if (!profile) return false
  return activeAndUnexpired(profile.pro_status, profile.pro_expires_at)
}

/**
 * Server-side fetch of the current user's subscription state — used by the
 * publish path's pre-flight check and any other gate that needs a fresh read.
 * Returns null if the profile lookup fails (treated as non-Studio).
 */
export async function fetchSubscriptionState(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionFields | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('studio_status, studio_source, studio_expires_at, pro_status, pro_source, pro_expires_at')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data as SubscriptionFields
}
