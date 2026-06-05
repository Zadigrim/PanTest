'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserCompPanel } from './UserCompPanel'
import { PendingTransfersList } from './PendingTransfersList'
import type { PersonRow } from './types'

/**
 * Person detail panel — Users tab.
 *
 * Spec sections, top → bottom:
 *   1. Header — name, legacy role (display-only), email (admin only)
 *   2. Platform admin — current status; toggle is DISABLED with
 *      TODO because no admin-toggle RPC exists today
 *   3. Subscriptions — two tiers (Studio, Pro) via UserCompPanel
 *   4. Institutions — memberships the person holds
 *   5. Pending transfers — incoming + outgoing
 *   6. Grant history — last 10 comp_subscriptions rows (admin only)
 */
export function PersonDetailPanel({
  row,
  isAdmin,
  currentUserId,
}: {
  row: PersonRow
  isAdmin: boolean
  currentUserId: string
}) {
  return (
    <div className="flex h-full flex-col">
      <Header row={row} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Section title="Platform admin">
          <PlatformAdminRow row={row} />
        </Section>

        <Section title="Subscriptions">
          {/* Acceptance + revoke writes go through comp_subscriptions
              regardless of viewer: admin OR scoped manager via
              migration 054. RLS surfaces errors inline. */}
          <UserCompPanel userId={row.id} />
        </Section>

        <Section title="Institutions">
          <InstitutionMemberships userId={row.id} />
        </Section>

        <Section title="Pending transfers">
          <PendingTransfersList
            currentUserId={currentUserId}
            entity={{ kind: 'person', id: row.id }}
            canCancelOutgoing={isAdmin || row.id === currentUserId}
            isAdmin={isAdmin}
          />
        </Section>

        {isAdmin && (
          <Section title="Grant history">
            <GrantHistory userId={row.id} />
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ row }: { row: PersonRow }) {
  return (
    <header className="border-b border-surface-faintdiv px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Person</p>
      <h2 className="mt-1 text-[18px] font-bold text-ink">{row.name}</h2>
      <p className="mt-0.5 text-[11.5px] text-muted">
        {row.legacyRole ?? 'collector'}{' '}
        <span className="text-[10px] uppercase tracking-[1px] text-hairline">(legacy role · display only)</span>
      </p>
    </header>
  )
}

// ── Platform admin ────────────────────────────────────────────────────────────

function PlatformAdminRow({ row }: { row: PersonRow }) {
  // TODO: needs an admin-only `set_platform_admin(uuid, boolean)`
  //       RPC. Until that ships, the toggle is read-only and
  //       admins flip the bit via SQL.
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-surface-faintdiv px-3 py-2">
      <div>
        <p className="text-[13px] font-semibold text-ink">
          {row.isPlatformAdmin ? 'Is a platform admin' : 'Not a platform admin'}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted">
          {row.isPlatformAdmin
            ? 'Has unrestricted access across institutions, comps, and transfers.'
            : 'Toggle is admin-only and currently surfaces no RPC — set via SQL.'}
        </p>
      </div>
      <button
        type="button"
        disabled
        title="No set_platform_admin RPC yet — toggle is SQL-only."
        className="shrink-0 cursor-not-allowed rounded-[6px] border-[1.5px] border-hairline bg-white px-2.5 py-1 text-[11px] font-semibold text-hairline"
      >
        {row.isPlatformAdmin ? 'Revoke admin' : 'Grant admin'}
      </button>
    </div>
  )
}

// ── Institution memberships ──────────────────────────────────────────────────

interface MembershipRow {
  id: string
  institution_id: string
  role_label: string | null
  can_verify: boolean | null
  can_distribute_prizes: boolean | null
  can_design: boolean | null
  can_manage_employees: boolean | null
  can_view_analytics: boolean | null
  can_manage_billing: boolean | null
  institution?: { id: string; name: string | null } | null
}

function InstitutionMemberships({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MembershipRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('employee_authorizations')
        .select(
          'id, institution_id, role_label, can_verify, can_distribute_prizes, can_design, can_manage_employees, can_view_analytics, can_manage_billing, institution:institutions!institution_id(id, name)',
        )
        .eq('user_id', userId)
        .order('authorized_at', { ascending: true })
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data ?? []) as MembershipRow[])
    })()
    return () => { cancelled = true }
  }, [userId])

  if (error)            return <p className="text-[12px] text-red">{error}</p>
  if (rows === null)    return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) {
    return (
      <p className="rounded-[6px] border border-dashed border-hairline bg-surface-workspace px-3 py-2 text-[12px] text-muted">
        Not an employee at any institution.
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.id} className="rounded-[6px] border border-surface-faintdiv px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/access?tab=institutions&focus=institution:${r.institution_id}`}
                className="text-[12.5px] font-semibold text-ink hover:underline"
              >
                {r.institution?.name ?? 'Unknown institution'}
              </Link>
              {r.role_label && (
                <p className="mt-0.5 text-[10.5px] text-muted">{r.role_label}</p>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <FlagChip on={r.can_verify}            label="verify" />
            <FlagChip on={r.can_distribute_prizes} label="distribute" />
            <FlagChip on={r.can_design}            label="design" />
            <FlagChip on={r.can_manage_employees}  label="manage members" />
            <FlagChip on={r.can_view_analytics}    label="analytics" />
            <FlagChip on={r.can_manage_billing}    label="billing" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function FlagChip({ on, label }: { on: boolean | null | undefined; label: string }) {
  const active = on === true
  return (
    <span
      className={`rounded-full border-[1.5px] bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[1px] ${
        active ? 'border-green text-green' : 'border-hairline text-hairline'
      }`}
    >
      {label}
    </span>
  )
}

// ── Grant history ────────────────────────────────────────────────────────────

interface CompRow {
  id: string
  tier: 'pro' | 'studio'
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  note: string | null
  granted_by_profile?: { display_name: string | null } | null
}

function GrantHistory({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CompRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('comp_subscriptions')
        .select(
          'id, tier, granted_at, expires_at, revoked_at, note, granted_by_profile:profiles!granted_by(display_name)',
        )
        .eq('user_id', userId)
        .order('granted_at', { ascending: false })
        .limit(10)
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data ?? []) as CompRow[])
    })()
    return () => { cancelled = true }
  }, [userId])

  if (error)            return <p className="text-[12px] text-red">{error}</p>
  if (rows === null)    return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) return <p className="text-[12px] text-muted">No comp grants for this person.</p>

  return (
    <>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="rounded-[6px] border border-surface-faintdiv px-3 py-2">
            <p className="text-[12.5px] font-semibold text-ink">
              {r.tier.toUpperCase()} <StatusChip row={r} />
            </p>
            <p className="mt-0.5 text-[10.5px] text-muted">
              granted {fmtDate(r.granted_at)}
              {r.granted_by_profile?.display_name ? ` by ${r.granted_by_profile.display_name}` : ''}
              {r.expires_at ? ` · expires ${fmtDate(r.expires_at)}` : ''}
              {r.revoked_at ? ` · revoked ${fmtDate(r.revoked_at)}` : ''}
            </p>
            {r.note && <p className="mt-0.5 text-[11px] italic text-muted">{r.note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10.5px] text-muted">
        Single source: the comp_subscriptions audit table.{' '}
        <Link href="/access/comp-subscriptions" className="text-blue hover:underline">
          See all grants →
        </Link>
      </p>
    </>
  )
}

function StatusChip({ row }: { row: CompRow }) {
  const now = Date.now()
  let label = 'Active'
  let cls = 'border-green text-green'
  if (row.revoked_at) { label = 'Revoked'; cls = 'border-red text-red' }
  else if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    label = 'Expired'; cls = 'border-muted text-muted'
  }
  return (
    <span className={`ml-1 inline-flex items-center rounded-full border-[1.5px] bg-white px-1.5 py-0.5 text-[9.5px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Section + utils ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[9.5px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
        {title}
      </p>
      <div>{children}</div>
    </section>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
