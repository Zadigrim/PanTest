'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PendingTransfersList } from './PendingTransfersList'
import type { InstitutionRow } from './types'

/**
 * Institution detail panel — Institutions tab.
 *
 * Spec sections, top → bottom:
 *   1. Header — name, category/type, location, created date
 *   2. Stat row — Members / Passports / Acquired
 *   3. Access — Free · civic (permanent) OR commercial tier + pricing
 *   4. Contract terms — disabled section (no columns yet)
 *   5. Members — capability flags preview + deep link to roster
 *   6. Suspend — disabled action (no mechanism yet)
 *   7. Pending transfers — incoming + outgoing
 *
 * The deep editor at /access/institutions/[id] is preserved and
 * surfaced via "Manage members →" so we don't duplicate its
 * per-member editing UI inside a 380px panel.
 */
export function InstitutionDetailPanel({
  row,
  isAdmin,
  managedInstitutionIds,
  currentUserId,
}: {
  row: InstitutionRow
  isAdmin: boolean
  managedInstitutionIds: string[]
  currentUserId: string
}) {
  const canManage = isAdmin || managedInstitutionIds.includes(row.id)

  return (
    <div className="flex h-full flex-col">
      <Header row={row} canManage={canManage} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <StatRow row={row} />

        <Section title="Access">
          <AccessBlock row={row} />
        </Section>

        <Section title="Contract terms">
          {/* TODO: needs institutions.contract_ref / contract_start /
              contract_end / payment_terms / renewal_date columns
              and a `can_manage_billing`-gated PATCH path. */}
          <p className="rounded-[6px] border border-dashed border-hairline bg-surface-workspace px-3 py-2 text-[12px] text-muted">
            Contract metadata (ref, term dates, payment terms, renewal)
            isn&rsquo;t on the schema yet. This section will light up
            once the columns + PATCH path land.
          </p>
        </Section>

        <Section title="Members">
          <p className="mb-2 text-[10.5px] italic text-muted">
            Members are institution staff &mdash; not collectors of
            their passports.
          </p>
          <CapabilityFlagsPreview institutionId={row.id} canManage={canManage} />
        </Section>

        <Section title="Suspend institution">
          {/* TODO: needs institutions.suspended_at column +
              suspend_institution(uuid) admin RPC. */}
          <button
            type="button"
            disabled
            title="No suspend_institution RPC yet."
            className="cursor-not-allowed rounded-[6px] border-[1.5px] border-hairline bg-white px-2.5 py-1 text-[11px] font-semibold text-hairline"
          >
            Suspend
          </button>
          <p className="mt-1.5 text-[10.5px] text-muted">
            No suspend mechanism in the schema yet.
          </p>
        </Section>

        <Section title="Pending transfers">
          <PendingTransfersList
            currentUserId={currentUserId}
            entity={{ kind: 'institution', id: row.id }}
            canCancelOutgoing={isAdmin}
            isAdmin={isAdmin}
          />
        </Section>
      </div>
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header({ row, canManage }: { row: InstitutionRow; canManage: boolean }) {
  return (
    <header className="border-b border-surface-faintdiv px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[2px] text-blue">Institution</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-ink">{row.name}</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {row.institutionType ?? '—'}
            {/* TODO: needs institutions.address_* columns. Until
                then we render only what's actually on the row. */}
            <span className="ml-1 text-[10px] uppercase tracking-[1px] text-hairline">· location not on schema</span>
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">
            created {new Date(row.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        {canManage && (
          <Link
            href={`/access/institutions/${row.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-[6px] border-[1.5px] border-ink bg-white px-3 text-[12px] font-medium text-ink hover:bg-surface-workspace"
          >
            Manage members →
          </Link>
        )}
      </div>
    </header>
  )
}

// ── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ row }: { row: InstitutionRow }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-[8px] border border-surface-faintdiv">
      <Stat label="Members"   value={row.memberCount} />
      <Stat label="Passports" value={row.passportCount} divider />
      <Stat label="Acquired"  value={row.acquiredCount} divider />
    </div>
  )
}
function Stat({ label, value, divider = false }: { label: string; value: number; divider?: boolean }) {
  return (
    <div className={`px-3 py-2.5 text-center ${divider ? 'border-l border-surface-faintdiv' : ''}`}>
      <p className="text-[18px] font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">{label}</p>
    </div>
  )
}

// ── Access block ─────────────────────────────────────────────────────────────

function AccessBlock({ row }: { row: InstitutionRow }) {
  if (row.accessKind === 'free-civic') {
    return (
      <div className="rounded-[6px] border-[1.5px] border-green bg-white px-3 py-2">
        <p className="text-[12.5px] font-semibold text-green">Free · civic (permanent)</p>
        <p className="mt-0.5 text-[10.5px] text-muted">
          Civic and educational institutions stay on the permanent free
          tier &mdash; no contract or renewal.
        </p>
      </div>
    )
  }
  if (row.accessKind === 'commercial') {
    return (
      <div className="rounded-[6px] border-[1.5px] border-blue bg-white px-3 py-2">
        <p className="text-[12.5px] font-semibold text-blue">
          {row.tier ?? 'Commercial'}{row.pricingModel ? ` · ${row.pricingModel}` : ''}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted">
          Commercial tier. Contract terms + renewal lives in the
          section below once the schema gains those columns.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-[6px] border border-dashed border-hairline bg-surface-workspace px-3 py-2">
      <p className="text-[12px] text-muted">No access tier set on this institution.</p>
    </div>
  )
}

// ── Capability flags preview (members) ──────────────────────────────────────

interface EmployeeRow {
  user_id: string
  can_verify: boolean | null
  can_distribute_prizes: boolean | null
  can_design: boolean | null
  can_manage_employees: boolean | null
  can_view_analytics: boolean | null
  can_manage_billing: boolean | null
}

const FLAG_DEFS: { key: keyof EmployeeRow; label: string; state: 'enforced' | 'partial' | 'unenforced' }[] = [
  { key: 'can_verify',            label: 'verify',            state: 'enforced' },
  { key: 'can_distribute_prizes', label: 'distribute prizes', state: 'enforced' },
  { key: 'can_design',            label: 'design',            state: 'enforced' },
  { key: 'can_manage_employees',  label: 'manage employees',  state: 'enforced' },
  { key: 'can_view_analytics',    label: 'view analytics',    state: 'enforced' },
  { key: 'can_manage_billing',    label: 'manage billing',    state: 'partial' },
]

function CapabilityFlagsPreview({ institutionId, canManage }: { institutionId: string; canManage: boolean }) {
  const [rows, setRows] = useState<EmployeeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('employee_authorizations')
        .select('user_id, can_verify, can_distribute_prizes, can_design, can_manage_employees, can_view_analytics, can_manage_billing')
        .eq('institution_id', institutionId)
        .order('user_id')
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data ?? []) as EmployeeRow[])
    })()
    return () => { cancelled = true }
  }, [institutionId])

  if (error)         return <p className="text-[12px] text-red">{error}</p>
  if (rows === null) return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) {
    return (
      <p className="rounded-[6px] border border-dashed border-hairline bg-surface-workspace px-3 py-2 text-[12px] text-muted">
        No members yet. {canManage && (
          <Link href={`/access/institutions/${institutionId}`} className="text-blue hover:underline">
            Add the first one →
          </Link>
        )}
      </p>
    )
  }

  const tallies = FLAG_DEFS.map((f) => ({
    ...f,
    onCount: rows.filter((r) => r[f.key] === true).length,
  }))

  return (
    <>
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="text-left">
            <th className="pb-1 font-medium text-muted">Capability</th>
            <th className="pb-1 text-right font-medium text-muted">Members with it</th>
          </tr>
        </thead>
        <tbody>
          {tallies.map((t) => (
            <tr key={t.key as string} className="border-t border-surface-faintdiv">
              <td className="py-1.5">
                <span className="text-ink">{t.label}</span>
                {t.state === 'partial' && (
                  <span className="ml-1.5 text-[9.5px] uppercase text-muted">(partial)</span>
                )}
                {t.state === 'unenforced' && (
                  <span className="ml-1.5 text-[9.5px] uppercase text-accent" title="Toggle is read-only — server doesn't enforce this flag yet">
                    (not yet enforced)
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink">
                {t.onCount}<span className="text-muted"> / {rows.length}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[10.5px] text-muted">
        Per-member toggle lives in the institution&rsquo;s detail page. Open{' '}
        <Link href={`/access/institutions/${institutionId}`} className="text-blue hover:underline">
          Manage members →
        </Link>{' '}
        to edit individual flags.
      </p>
    </>
  )
}

// ── Section helper ──
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
