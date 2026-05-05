import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PanoplyConnectRole =
  | 'individual_creator'
  | 'institutional_manager'
  | 'institutional_employee'
  | 'designer'
  | 'platform_admin'

export interface RoleContext {
  roles: PanoplyConnectRole[]
  activeRole: PanoplyConnectRole
  institutions: { id: string; name: string; institution_type: string | null }[]
}

// ─── detectRoles ──────────────────────────────────────────────────────────────

export async function detectRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<RoleContext> {
  const roles: PanoplyConnectRole[] = []
  const institutions: RoleContext['institutions'] = []

  // ── 1. profiles.role + profiles.connect_roles ──────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, connect_roles')
    .eq('id', userId)
    .single()

  if (profile) {
    // 'creator' in profiles.role maps to 'individual_creator'
    if (profile.role === 'creator') {
      roles.push('individual_creator')
    }
    // connect_roles is an array of additional PanoplyConnectRole values
    const connectRoles = (profile.connect_roles ?? []) as PanoplyConnectRole[]
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
  const ROLE_PRIORITY: PanoplyConnectRole[] = [
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

export const ROLE_LABELS: Record<PanoplyConnectRole, string> = {
  individual_creator:    'Creator',
  institutional_manager: 'Institution Manager',
  institutional_employee:'Employee',
  designer:              'Designer',
  platform_admin:        'Panoply Admin',
}
