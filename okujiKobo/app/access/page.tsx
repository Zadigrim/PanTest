import { redirect } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { AccessClient } from './AccessClient'
import type { AccessEntityRow, AccessPendingTransfers } from './types'

export const metadata = { title: 'Access — okuji' }

/**
 * /access — Access Management, master/detail rewrite.
 *
 * Server side: scope-detect (admin vs institutional manager),
 * fetch the relevant people + institutions + pending-transfers
 * counts in one batch, hand the merged payload to the client
 * orchestrator. No UI here beyond AppNav + container.
 *
 * SCOPE
 *   Admin     → every profile + every institution
 *   Manager   → self profile + every employee of any institution
 *               they manage + their managed institutions
 *   Other     → redirect to dashboard (no access)
 *
 * Comp-subscription RLS today is admin-only (migration 036). The
 * AccessClient surfaces a disabled "+ Grant comp" affordance with
 * an inline TODO for manager visits. Admin visits get the live
 * button.
 */
export default async function AccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/access')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ── Scope detection ──────────────────────────────────────────
  // Admin via the existing SECURITY DEFINER RPC. Managers come in
  // through institutions.id = auth.uid() (direct manager) OR
  // employee_authorizations with can_manage_employees=true.
  const [{ data: adminRes }, { data: ownInstRes }, { data: ownEmpRes }] = await Promise.all([
    db.rpc('is_platform_admin'),
    db.from('institutions').select('id, name').eq('id', user.id),
    db
      .from('employee_authorizations')
      .select('institution_id')
      .eq('user_id', user.id)
      .eq('can_manage_employees', true),
  ])
  const isAdmin = adminRes === true

  const managedInstitutionIds = new Set<string>([
    ...((ownInstRes ?? []) as { id: string }[]).map((r) => r.id),
    ...((ownEmpRes ?? []) as { institution_id: string }[]).map((r) => r.institution_id),
  ])

  if (!isAdmin && managedInstitutionIds.size === 0) {
    redirect('/?denied=access')
  }

  // ── Institutions ─────────────────────────────────────────────
  let institutionsQuery = db
    .from('institutions')
    .select('id, name, tier, pricing_model, institution_type, created_at')
    .order('name', { ascending: true })
  if (!isAdmin) {
    institutionsQuery = institutionsQuery.in('id', Array.from(managedInstitutionIds))
  }
  const { data: institutionsRaw } = await institutionsQuery
  const institutions = (institutionsRaw ?? []) as Array<{
    id: string
    name: string
    tier: string | null
    pricing_model: string | null
    institution_type: string | null
    created_at: string
  }>
  const institutionIds = institutions.map((i) => i.id)

  // ── Employee counts per institution ──────────────────────────
  const employeeCounts = new Map<string, number>()
  if (institutionIds.length > 0) {
    const { data: empRows } = await db
      .from('employee_authorizations')
      .select('institution_id')
      .in('institution_id', institutionIds)
    for (const r of (empRows ?? []) as { institution_id: string }[]) {
      employeeCounts.set(r.institution_id, (employeeCounts.get(r.institution_id) ?? 0) + 1)
    }
  }

  // ── People ───────────────────────────────────────────────────
  // Admin scope: every profile with subscription columns.
  // Manager scope: self + every employee of the institutions
  // they manage.
  let peopleIds: string[] | null = null  // null = no filter (admin)
  if (!isAdmin) {
    const { data: empOfMine } = await db
      .from('employee_authorizations')
      .select('user_id')
      .in('institution_id', Array.from(managedInstitutionIds))
    peopleIds = [
      user.id,
      ...((empOfMine ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ]
  }

  let peopleQuery = db
    .from('profiles')
    .select(
      'id, display_name, role, created_at, studio_status, studio_source, studio_expires_at, pro_status, pro_source, pro_expires_at',
    )
    .order('display_name', { ascending: true })
  if (peopleIds !== null) {
    peopleQuery = peopleQuery.in('id', peopleIds)
  }
  const { data: peopleRaw } = await peopleQuery
  const people = (peopleRaw ?? []) as Array<{
    id: string
    display_name: string | null
    role: string | null
    created_at: string
    studio_status: string | null
    studio_source: string | null
    studio_expires_at: string | null
    pro_status: string | null
    pro_source: string | null
    pro_expires_at: string | null
  }>

  // ── Pending transfers (counts per entity) ────────────────────
  // RLS already bounds visibility; admin sees all pendings.
  const transferCounts: AccessPendingTransfers = {
    byPersonId: {},
    byInstitutionId: {},
  }
  const { data: transferRows } = await db
    .from('passport_transfers')
    .select('id, passport_id, to_user_id, to_institution_id, initiated_by, status')
    .eq('status', 'pending')
  for (const t of (transferRows ?? []) as Array<{
    to_user_id: string | null
    to_institution_id: string | null
    initiated_by: string
  }>) {
    if (t.to_user_id) {
      transferCounts.byPersonId[t.to_user_id] =
        (transferCounts.byPersonId[t.to_user_id] ?? 0) + 1
    }
    if (t.to_institution_id) {
      transferCounts.byInstitutionId[t.to_institution_id] =
        (transferCounts.byInstitutionId[t.to_institution_id] ?? 0) + 1
    }
    transferCounts.byPersonId[t.initiated_by] =
      (transferCounts.byPersonId[t.initiated_by] ?? 0) + 1
  }

  // ── Project to a unified row list for the client ─────────────
  const rows: AccessEntityRow[] = [
    ...people.map((p): AccessEntityRow => ({
      kind: 'person',
      id: p.id,
      name: p.display_name ?? 'Untitled',
      sub: p.role ?? null,
      tier: derivePersonTier(p),
      tierSource: derivePersonTierSource(p),
      expiresAt: derivePersonExpiry(p),
      transferCount: transferCounts.byPersonId[p.id] ?? 0,
      createdAt: p.created_at,
      raw: p,
    })),
    ...institutions.map((i): AccessEntityRow => ({
      kind: 'institution',
      id: i.id,
      name: i.name,
      sub: i.institution_type ?? null,
      tier: i.tier ?? null,
      tierSource: null,
      pricingModel: i.pricing_model,
      employeeCount: employeeCounts.get(i.id) ?? 0,
      expiresAt: null,
      transferCount: transferCounts.byInstitutionId[i.id] ?? 0,
      createdAt: i.created_at,
      raw: i,
    })),
  ]

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-5">
          <h1 className="text-[25px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Access
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {isAdmin
              ? 'People, institutions, and the comp grants + transfers between them.'
              : 'Your institution and its members.'}
          </p>
        </header>

        <AccessClient
          rows={rows}
          isAdmin={isAdmin}
          currentUserId={user.id}
          managedInstitutionIds={Array.from(managedInstitutionIds)}
        />
      </main>
    </div>
  )
}

// ── Derivations ─────────────────────────────────────────────────────────────

function derivePersonTier(p: {
  studio_status: string | null
  studio_expires_at: string | null
  pro_status: string | null
  pro_expires_at: string | null
}): 'studio' | 'pro' | null {
  if (isActive(p.studio_status, p.studio_expires_at)) return 'studio'
  if (isActive(p.pro_status,    p.pro_expires_at))    return 'pro'
  return null
}

function derivePersonTierSource(p: {
  studio_status: string | null
  studio_source: string | null
  studio_expires_at: string | null
  pro_status: string | null
  pro_source: string | null
  pro_expires_at: string | null
}): 'comp' | 'paid' | null {
  if (isActive(p.studio_status, p.studio_expires_at)) {
    return p.studio_source === 'paid' ? 'paid' : 'comp'
  }
  if (isActive(p.pro_status, p.pro_expires_at)) {
    return p.pro_source === 'paid' ? 'paid' : 'comp'
  }
  return null
}

function derivePersonExpiry(p: {
  studio_status: string | null
  studio_expires_at: string | null
  pro_status: string | null
  pro_expires_at: string | null
}): string | null {
  if (isActive(p.studio_status, p.studio_expires_at)) return p.studio_expires_at
  if (isActive(p.pro_status,    p.pro_expires_at))    return p.pro_expires_at
  return null
}

function isActive(status: string | null, expires: string | null): boolean {
  if (status !== 'active') return false
  if (!expires) return true
  return new Date(expires).getTime() > Date.now()
}
