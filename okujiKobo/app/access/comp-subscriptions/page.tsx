'use client'

// Platform-admin UI for granting / revoking comp subscriptions
// (BLD-12). Grants are records in public.comp_subscriptions; the
// sync_comp_to_profile trigger keeps profiles.{pro,studio}_status
// in sync. RLS on comp_subscriptions is admin-only.
//
// Deliberately minimal:
//   - List of current grants (active + recent revoked/expired)
//   - Grant form (email lookup, tier, optional expiration, optional note)
//   - Revoke button (sets revoked_at = now())
// No notifications, no usage stats, no expiration warnings. Add later
// based on actual usage signal.

import { FormEvent, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tier = 'pro' | 'studio'

interface GrantRow {
  id: string
  userId: string
  displayName: string | null
  tier: Tier
  grantedAt: string
  expiresAt: string | null
  revokedAt: string | null
  note: string | null
}

function statusOf(row: GrantRow): 'active' | 'expired' | 'revoked' {
  if (row.revokedAt) return 'revoked'
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return 'expired'
  return 'active'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CompSubscriptionsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [rows, setRows] = useState<GrantRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
      if (!isAdmin) { setAuthorized(false); return }
      setAuthorized(true)

      await loadGrants()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadGrants() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('comp_subscriptions')
      .select(`
        id, user_id, tier, granted_at, expires_at, revoked_at, note,
        profile:profiles!user_id(display_name)
      `)
      .order('granted_at', { ascending: false })

    if (error) {
      setLoadError(error.message)
      setLoading(false)
      return
    }

    type RawRow = {
      id: string
      user_id: string
      tier: Tier
      granted_at: string
      expires_at: string | null
      revoked_at: string | null
      note: string | null
      profile: { display_name: string | null } | null
    }

    setRows(((data ?? []) as unknown as RawRow[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.profile?.display_name ?? null,
      tier: r.tier,
      grantedAt: r.granted_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at,
      note: r.note,
    })))
    setLoading(false)
  }

  if (authorized === null) {
    return <main className="px-6 py-12 max-w-5xl mx-auto"><p className="text-muted">Loading…</p></main>
  }

  if (authorized === false) {
    return (
      <main className="px-6 py-12 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-navy mb-2">Forbidden</h1>
        <p className="text-muted">Comp subscriptions are managed by platform admins only.</p>
      </main>
    )
  }

  return (
    <main className="px-6 py-12 max-w-5xl mx-auto space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-navy">Comp subscriptions</h1>
        <p className="text-sm text-muted mt-1">
          Grant Pro or Studio access without billing. Revoke at any time. The
          user&apos;s profile subscription state is kept in sync automatically.
        </p>
      </header>

      <GrantForm onGranted={loadGrants} />

      <section>
        <h2 className="text-base font-semibold text-navy mb-3">All grants</h2>
        {loadError && <p className="text-red mb-3">{loadError}</p>}
        {loading ? (
          <p className="text-muted">Loading grants…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted">No comp subscriptions yet.</p>
        ) : (
          <div className="overflow-x-auto border border-hairline rounded-panel">
            <table className="w-full text-sm">
              <thead className="bg-cream/50">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium text-muted">User</th>
                  <th className="px-4 py-2.5 font-medium text-muted">Tier</th>
                  <th className="px-4 py-2.5 font-medium text-muted">Granted</th>
                  <th className="px-4 py-2.5 font-medium text-muted">Expires</th>
                  <th className="px-4 py-2.5 font-medium text-muted">Status</th>
                  <th className="px-4 py-2.5 font-medium text-muted">Note</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => <GrantTableRow key={r.id} row={r} onRevoked={loadGrants} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function GrantForm({ onGranted }: { onGranted: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [tier, setTier] = useState<Tier>('studio')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError('Email is required.'); return }

    startTransition(async () => {
      // Look up the target user by email (admin-or-employee gated route).
      const lookupRes = await fetch('/api/employees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })
      const lookupJson = await lookupRes.json().catch(() => ({}))
      if (!lookupRes.ok || !lookupJson?.userId) {
        setError(lookupJson?.error ?? `No account found for ${trimmedEmail}`)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }

      const { error: insertErr } = await supabase
        .from('comp_subscriptions')
        .insert({
          user_id: lookupJson.userId,
          tier,
          granted_by: user.id,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          note: note.trim() || null,
        })

      if (insertErr) {
        setError(insertErr.message)
        return
      }

      setEmail(''); setTier('studio'); setExpiresAt(''); setNote('')
      await onGranted()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-panel border border-hairline p-5"
      aria-label="Grant comp subscription"
    >
      <h2 className="text-base font-semibold text-navy mb-4">Grant a comp</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy">Email <span className="text-accent">*</span></span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            className="border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="pro">Pro</option>
            <option value="studio">Studio</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-navy">Expires (optional)</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-navy">Internal note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="border border-hairline rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
      </div>

      {error && <p className="text-red mt-3 text-sm">{error}</p>}

      <div className="mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-panel bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-green disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Granting…' : 'Grant'}
        </button>
      </div>
    </form>
  )
}

function GrantTableRow({ row, onRevoked }: { row: GrantRow; onRevoked: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const status = statusOf(row)

  function handleRevoke() {
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from('comp_subscriptions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', row.id)
      if (updateErr) {
        setError(updateErr.message)
        return
      }
      await onRevoked()
    })
  }

  const statusColors: Record<typeof status, string> = {
    active: 'text-green',
    expired: 'text-muted',
    revoked: 'text-red',
  }

  return (
    <tr className="border-t border-hairline">
      <td className="px-4 py-3">
        <div className="text-navy">{row.displayName ?? <span className="text-muted">—</span>}</div>
        <div className="text-xs text-muted font-mono">{row.userId.slice(0, 8)}…</div>
      </td>
      <td className="px-4 py-3 capitalize">{row.tier}</td>
      <td className="px-4 py-3">{formatDate(row.grantedAt)}</td>
      <td className="px-4 py-3">{formatDate(row.expiresAt)}</td>
      <td className={`px-4 py-3 capitalize ${statusColors[status]}`}>{status}</td>
      <td className="px-4 py-3 text-muted text-xs max-w-xs truncate">{row.note ?? '—'}</td>
      <td className="px-4 py-3 text-right">
        {status === 'active' ? (
          <button
            onClick={handleRevoke}
            disabled={isPending}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {isPending ? 'Revoking…' : 'Revoke'}
          </button>
        ) : null}
        {error && <div className="text-xs text-red mt-1">{error}</div>}
      </td>
    </tr>
  )
}
