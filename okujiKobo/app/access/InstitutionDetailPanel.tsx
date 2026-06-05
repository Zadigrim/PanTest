'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PendingTransfersList } from './PendingTransfersList'
import type { AccessEntityRow } from './types'

/**
 * Right-column panel for a selected INSTITUTION.
 *
 * Slim by design: the existing /access/institutions/[id] page
 * is much deeper (members table + properties form + passports
 * list), so this panel surfaces the at-a-glance state and deep-
 * links into the full editor for member-level changes. Avoids
 * duplicating that surface.
 *
 * Sections:
 *   1. Header — name, tier, pricing_model, institution_type
 *   2. Capability flags (preview) — counts only; deep link to
 *      the institution detail page for per-employee editing
 *   3. Pending transfers
 */
export function InstitutionDetailPanel({
  row,
  isAdmin,
  managedInstitutionIds,
  currentUserId,
}: {
  row: AccessEntityRow
  isAdmin: boolean
  managedInstitutionIds: string[]
  currentUserId: string
}) {
  const canManage = isAdmin || managedInstitutionIds.includes(row.id)

  return (
    <div className="flex h-full flex-col">
      <Header row={row} canManage={canManage} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Section title="Capabilities">
          <CapabilityFlagsPreview institutionId={row.id} canManage={canManage} />
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

// ── Header ────────────────────────────────────────────────────────────────

function Header({
  row,
  canManage,
}: {
  row: AccessEntityRow
  canManage: boolean
}) {
  return (
    <header className="border-b border-surface-faintdiv px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[2px] text-blue">Institution</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-ink">{row.name}</h2>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {[row.raw.institution_type, row.tier, row.pricingModel].filter(Boolean).join(' · ') || '—'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {row.tier && (
              <Chip variant="blue">{row.tier}</Chip>
            )}
            {row.pricingModel && (
              <Chip variant="muted">{row.pricingModel}</Chip>
            )}
            {typeof row.employeeCount === 'number' && row.employeeCount > 0 && (
              <Chip variant="muted">{row.employeeCount} members</Chip>
            )}
          </div>
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

// ── Capability flags preview ──────────────────────────────────────────────

interface EmployeeRow {
  user_id: string
  can_verify: boolean
  can_distribute_prizes: boolean
  can_design: boolean
  can_manage_employees: boolean
  can_view_analytics: boolean
  can_manage_billing: boolean
  profile?: { display_name: string | null } | null
}

const FLAG_DEFS: {
  key: keyof EmployeeRow
  label: string
  /** 'enforced' = real teeth somewhere on the server today.
   *  'partial'  = some surfaces enforce it, others don't yet.
   *  'unenforced' = schema-only; the new screen renders a TODO. */
  state: 'enforced' | 'partial' | 'unenforced'
}[] = [
  { key: 'can_verify',            label: 'verify',            state: 'enforced' },
  { key: 'can_distribute_prizes', label: 'distribute prizes', state: 'enforced' },
  { key: 'can_design',            label: 'design',            state: 'enforced' },
  // Gates /manage/employees page entry + /api/employees/lookup
  // (BLD-02 enforcement) + the existing institution / transfer
  // write paths.
  { key: 'can_manage_employees',  label: 'manage employees',  state: 'enforced' },
  // Now gates /api/analytics (migration 054 companion change).
  { key: 'can_view_analytics',    label: 'view analytics',    state: 'enforced' },
  // Gates tier / pricing / revenue fields on PATCH /api/institutions
  // — operational fields still allow any employee, so 'partial'.
  { key: 'can_manage_billing',    label: 'manage billing',    state: 'partial' },
]

function CapabilityFlagsPreview({
  institutionId,
  canManage,
}: {
  institutionId: string
  canManage: boolean
}) {
  const [rows, setRows] = useState<EmployeeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('employee_authorizations')
        .select(
          'user_id, can_verify, can_distribute_prizes, can_design, can_manage_employees, can_view_analytics, can_manage_billing, profile:profiles!user_id(display_name)',
        )
        .eq('institution_id', institutionId)
        .order('user_id')
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data ?? []) as EmployeeRow[])
    })()
    return () => { cancelled = true }
  }, [institutionId])

  if (error) return <p className="text-[12px] text-red">{error}</p>
  if (rows === null) return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) {
    return (
      <p className="rounded-[6px] border border-dashed border-hairline bg-surface-workspace px-3 py-2 text-[12px] text-muted">
        No employees yet. {canManage && (
          <Link href={`/access/institutions/${institutionId}`} className="text-blue hover:underline">
            Add the first one →
          </Link>
        )}
      </p>
    )
  }

  // Tally flag-on counts per capability across the team.
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
                  /* TODO: needs server enforcement for {t.label} */
                  <span
                    className="ml-1.5 text-[9.5px] uppercase text-accent"
                    title="Toggle is read-only — server doesn't enforce this flag yet"
                  >
                    (not enforced)
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

// ── Section + chip helpers ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p
        className="mb-2 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        {title}
      </p>
      <div>{children}</div>
    </section>
  )
}

function Chip({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'muted' | 'blue' }) {
  const cls =
    variant === 'blue'  ? 'border-blue text-blue'
    : variant === 'muted' ? 'border-hairline text-muted'
    : 'border-ink text-ink'
  return (
    <span className={`inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}
