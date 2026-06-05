import { redirect } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { AccessClient } from './AccessClient'
import type { InstitutionRow, PersonRow, AccessPendingTransfers } from './types'

export const metadata = { title: 'Access Management — okuji' }

/**
 * /access — Access Management, two-tab master/detail rewrite.
 *
 * Server: scope-detect (admin vs institutional manager), batch-
 * fetch the data both tabs need (people · institutions · per-
 * institution member/passport/acquisition counts · pending-
 * transfer counts), hand off to the client tabs container.
 *
 * SCOPE
 *   Admin     → every profile + every institution
 *   Manager   → self profile + employees of managed institutions
 *                + the managed institutions
 *   Other     → /?denied=access
 */
export default async function AccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/access')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ── Scope ──
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

  // ── Institutions ──
  let instQ = db
    .from('institutions')
    .select('id, name, tier, pricing_model, institution_type, created_at')
    .order('name', { ascending: true })
  if (!isAdmin) instQ = instQ.in('id', Array.from(managedInstitutionIds))
  const { data: institutionsRaw } = await instQ
  const institutionsList = (institutionsRaw ?? []) as Array<{
    id: string
    name: string
    tier: string | null
    pricing_model: string | null
    institution_type: string | null
    created_at: string
  }>
  const institutionIds = institutionsList.map((i) => i.id)

  // ── Counts per institution ──
  // Three queries fan-out in parallel; the aggregation is done
  // in JS (PostgREST GROUP BY would need an RPC).
  const memberCounts    = new Map<string, number>()
  const passportCounts  = new Map<string, number>()
  const acquiredCounts  = new Map<string, number>()
  // We also need a passport_id → proprietor_id index so we can
  // count acquisitions per institution.
  const passportToInst  = new Map<string, string>()

  if (institutionIds.length > 0) {
    const [
      { data: empRows },
      { data: passRows },
    ] = await Promise.all([
      db.from('employee_authorizations').select('institution_id').in('institution_id', institutionIds),
      db.from('passports').select('id, proprietor_id').in('proprietor_id', institutionIds),
    ])

    for (const r of (empRows ?? []) as { institution_id: string }[]) {
      memberCounts.set(r.institution_id, (memberCounts.get(r.institution_id) ?? 0) + 1)
    }
    for (const r of (passRows ?? []) as { id: string; proprietor_id: string }[]) {
      passportCounts.set(r.proprietor_id, (passportCounts.get(r.proprietor_id) ?? 0) + 1)
      passportToInst.set(r.id, r.proprietor_id)
    }

    if (passportToInst.size > 0) {
      const { data: acqRows } = await db
        .from('acquisitions')
        .select('passport_id')
        .in('passport_id', Array.from(passportToInst.keys()))
      for (const r of (acqRows ?? []) as { passport_id: string }[]) {
        const inst = passportToInst.get(r.passport_id)
        if (!inst) continue
        acquiredCounts.set(inst, (acquiredCounts.get(inst) ?? 0) + 1)
      }
    }
  }

  // ── People ──
  let peopleIds: string[] | null = null
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
  let pplQ = db
    .from('profiles')
    .select(
      'id, display_name, role, created_at, is_platform_admin, studio_status, studio_source, studio_expires_at, pro_status, pro_source, pro_expires_at',
    )
    .order('display_name', { ascending: true })
  if (peopleIds !== null) pplQ = pplQ.in('id', peopleIds)
  const { data: peopleRaw } = await pplQ
  const peopleList = (peopleRaw ?? []) as Array<{
    id: string
    display_name: string | null
    role: string | null
    created_at: string
    is_platform_admin: boolean | null
    studio_status: string | null
    studio_source: string | null
    studio_expires_at: string | null
    pro_status: string | null
    pro_source: string | null
    pro_expires_at: string | null
  }>

  // ── Transfer counts ──
  const tx: AccessPendingTransfers = { byPersonId: {}, byInstitutionId: {} }
  const { data: txRows } = await db
    .from('passport_transfers')
    .select('to_user_id, to_institution_id, initiated_by')
    .eq('status', 'pending')
  for (const t of (txRows ?? []) as Array<{
    to_user_id: string | null
    to_institution_id: string | null
    initiated_by: string
  }>) {
    if (t.to_user_id) tx.byPersonId[t.to_user_id] = (tx.byPersonId[t.to_user_id] ?? 0) + 1
    if (t.to_institution_id) tx.byInstitutionId[t.to_institution_id] = (tx.byInstitutionId[t.to_institution_id] ?? 0) + 1
    tx.byPersonId[t.initiated_by] = (tx.byPersonId[t.initiated_by] ?? 0) + 1
  }

  // ── Projection ──
  const people: PersonRow[] = peopleList.map((p) => ({
    id: p.id,
    name: p.display_name ?? 'Untitled',
    legacyRole: p.role ?? null,
    joinedAt: p.created_at,
    tier: derivePersonTier(p),
    tierSource: derivePersonTierSource(p),
    expiresAt: derivePersonExpiry(p),
    isPlatformAdmin: p.is_platform_admin === true,
    transferCount: tx.byPersonId[p.id] ?? 0,
    raw: p,
  }))

  const institutions: InstitutionRow[] = institutionsList.map((i) => ({
    id: i.id,
    name: i.name,
    institutionType: i.institution_type ?? null,
    tier: i.tier ?? null,
    pricingModel: i.pricing_model ?? null,
    accessKind: i.tier === 'civic' ? 'free-civic'
              : i.tier === null    ? 'unknown'
              : 'commercial',
    memberCount:   memberCounts.get(i.id)   ?? 0,
    passportCount: passportCounts.get(i.id) ?? 0,
    acquiredCount: acquiredCounts.get(i.id) ?? 0,
    transferCount: tx.byInstitutionId[i.id] ?? 0,
    createdAt: i.created_at,
    raw: i,
  }))

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-5">
          <h1 className="text-[25px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Access Management
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {isAdmin
              ? 'Institutions, people, comp grants, and passport transfers — all in one place.'
              : 'Your institution and its members.'}
          </p>
        </header>

        <AccessClient
          people={people}
          institutions={institutions}
          isAdmin={isAdmin}
          currentUserId={user.id}
          managedInstitutionIds={Array.from(managedInstitutionIds)}
        />
      </main>
    </div>
  )
}

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
  if (isActive(p.studio_status, p.studio_expires_at)) return p.studio_source === 'paid' ? 'paid' : 'comp'
  if (isActive(p.pro_status,    p.pro_expires_at))    return p.pro_source    === 'paid' ? 'paid' : 'comp'
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
