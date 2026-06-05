'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserCompPanel } from './UserCompPanel'
import { PendingTransfersList } from './PendingTransfersList'
import type { AccessEntityRow } from './types'

/**
 * Right-column panel for a selected PERSON.
 *
 * Sections (top → bottom):
 *   1. Header — name + email (lazy) + role
 *   2. Subscriptions — UserCompPanel verbatim (reuses the
 *      grant + revoke through the same comp_subscriptions
 *      mechanism the prior page used)
 *   3. Pending transfers — incoming + outgoing they're involved in
 *   4. History — last 10 comp grants for them, including
 *      revoked / expired
 */
export function PersonDetailPanel({
  row,
  isAdmin,
  currentUserId,
}: {
  row: AccessEntityRow
  isAdmin: boolean
  currentUserId: string
}) {
  return (
    <div className="flex h-full flex-col">
      <Header row={row} isAdmin={isAdmin} canSeeEmail={isAdmin} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Section title="Subscriptions">
          {/* Managers are now permitted by migration 054:
              can_grant_comp_for(target). If the row isn't actually
              in the manager's scope, the underlying RLS will reject
              the INSERT/UPDATE and UserCompPanel surfaces the error
              inline — no separate UI gate needed here. */}
          <UserCompPanel userId={row.id} />
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

function Header({
  row,
  canSeeEmail,
}: {
  row: AccessEntityRow
  isAdmin: boolean
  canSeeEmail: boolean
}) {
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    if (!canSeeEmail) { setEmail(null); return }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/admin/users/${row.id}/email`)
        if (!res.ok) return
        const json = (await res.json()) as { email: string | null }
        if (!cancelled) setEmail(json.email ?? null)
      } catch {
        // Degrade silently — the route may be unreachable in a
        // mis-configured env; the header still reads fine without
        // the email line.
      }
    })()
    return () => { cancelled = true }
  }, [row.id, canSeeEmail])

  return (
    <header className="border-b border-surface-faintdiv px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Person</p>
      <h2 className="mt-1 text-[18px] font-bold text-ink">{row.name}</h2>
      <p className="mt-0.5 text-[11.5px] text-muted">
        {row.raw.role ?? 'collector'}
      </p>
      {email && (
        <p className="mt-1 font-mono text-[10.5px] text-muted">{email}</p>
      )}
    </header>
  )
}

// ── Grant history ──────────────────────────────────────────────────────────

interface CompRow {
  id: string
  tier: 'pro' | 'studio'
  granted_at: string
  expires_at: string | null
  revoked_at: string | null
  note: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  if (error) return <p className="text-[12px] text-red">{error}</p>
  if (rows === null) return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) {
    return <p className="text-[12px] text-muted">No comp grants for this person.</p>
  }

  return (
    <>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-3 rounded-[6px] border border-surface-faintdiv px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-ink">
                {r.tier.toUpperCase()}{' '}
                <StatusChip row={r} />
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">
                granted {fmtDate(r.granted_at)}
                {r.granted_by_profile?.display_name ? ` by ${r.granted_by_profile.display_name}` : ''}
                {r.expires_at ? ` · expires ${fmtDate(r.expires_at)}` : ''}
                {r.revoked_at ? ` · revoked ${fmtDate(r.revoked_at)}` : ''}
              </p>
              {r.note && <p className="mt-0.5 text-[11px] italic text-muted">{r.note}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10.5px] text-muted">
        Single source: the comp_subscriptions audit table.{' '}
        <Link href="/access/comp-subscriptions" className="text-blue hover:underline">
          See all grants in the audit log →
        </Link>
      </p>
    </>
  )
}

function StatusChip({ row }: { row: CompRow }) {
  const now = Date.now()
  let label = 'Active'
  let cls = 'border-green text-green'
  if (row.revoked_at) {
    label = 'Revoked'
    cls = 'border-red text-red'
  } else if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    label = 'Expired'
    cls = 'border-muted text-muted'
  }
  return (
    <span className={`ml-1 inline-flex items-center rounded-full border bg-white px-1.5 py-0.5 text-[9.5px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Section + utils ────────────────────────────────────────────────────────

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
