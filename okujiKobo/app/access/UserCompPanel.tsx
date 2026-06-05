'use client'

// Premium tier (Pro / Studio) display + grant / revoke for the Access
// Management Users panel. Reuses the existing comp_subscriptions
// mechanism — direct client INSERT/UPDATE against the comp_subscriptions
// table, protected by the migration-036 RLS policy that only admits
// platform admins. Mirrors the standalone /access/comp-subscriptions
// page's grant/revoke pattern so the underlying path stays single.
//
// Paid vs comp:
//   - profiles.{tier}_source = 'comp'  → revocable here (this is what
//                                        the admin granted; lists the
//                                        backing comp_subscriptions row
//                                        for revocation).
//   - profiles.{tier}_source = 'paid'  → read-only ("Paid" badge, no
//                                        revoke). Billing concern, not
//                                        admin-managed.
//   - profiles.{tier}_status = 'none'  → "Grant" affordance opens an
//                                        inline form (optional expiration
//                                        + optional note) and posts an
//                                        insert.
//
// The sync_comp_to_profile trigger (migration 036) propagates status to
// the profile on INSERT/UPDATE/DELETE of comp_subscriptions, so we just
// re-fetch the profile after a successful mutation and the panel
// reflects the new state.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isStudio, isPro, type SubscriptionFields } from '@/lib/roles'

type Tier = 'pro' | 'studio'

interface ActiveComp {
  id: string
  tier: Tier
  expires_at: string | null
  note: string | null
  granted_at: string
}

interface Props {
  userId: string
}

export function UserCompPanel({ userId }: Props) {
  const [profile, setProfile] = useState<SubscriptionFields | null>(null)
  const [comps, setComps] = useState<ActiveComp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [grantingTier, setGrantingTier] = useState<Tier | null>(null)
  const [pending, setPending] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const [profileRes, compsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('pro_status, pro_source, pro_expires_at, studio_status, studio_source, studio_expires_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('comp_subscriptions')
        .select('id, tier, expires_at, note, granted_at')
        .eq('user_id', userId)
        .is('revoked_at', null),
    ])
    if (profileRes.error) {
      setError(profileRes.error.message)
    } else {
      setProfile((profileRes.data ?? null) as SubscriptionFields | null)
    }
    if (!compsRes.error) {
      setComps(((compsRes.data ?? []) as unknown as ActiveComp[]))
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // Reset transient state if the selected user changes.
    setGrantingTier(null)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGrant(tier: Tier, expiresAt: string, note: string) {
    setError(null)
    setPending(true)
    try {
      const supabase = createClient()
      const { data: { user: admin } } = await supabase.auth.getUser()
      if (!admin) {
        setError('Not signed in')
        return
      }
      const { error: insertErr } = await supabase.from('comp_subscriptions').insert({
        user_id: userId,
        tier,
        granted_by: admin.id,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        note: note.trim() || null,
      })
      if (insertErr) {
        setError(insertErr.message)
        return
      }
      setGrantingTier(null)
      await load()
    } finally {
      setPending(false)
    }
  }

  async function handleRevoke(compId: string) {
    if (!window.confirm('Revoke this comp subscription? The user will lose this tier immediately.')) return
    setError(null)
    setPending(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase
        .from('comp_subscriptions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', compId)
      if (updateErr) {
        setError(updateErr.message)
        return
      }
      await load()
    } finally {
      setPending(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-muted">Loading subscription state…</p>
  }

  const studioActive = isStudio(profile)
  const proActive = isPro(profile)

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-panel border border-accent/30 bg-red-50 px-2 py-1.5 text-xs text-accent">
          {error}
        </p>
      )}

      <TierRow
        tier="studio"
        label="Studio"
        active={studioActive}
        source={profile?.studio_source ?? null}
        expiresAt={profile?.studio_expires_at ?? null}
        activeComp={comps.find((c) => c.tier === 'studio') ?? null}
        granting={grantingTier === 'studio'}
        pending={pending}
        onGrantOpen={() => setGrantingTier('studio')}
        onGrantCancel={() => setGrantingTier(null)}
        onGrantSubmit={(exp, note) => handleGrant('studio', exp, note)}
        onRevoke={handleRevoke}
      />

      <TierRow
        tier="pro"
        label="Pro"
        active={proActive}
        source={profile?.pro_source ?? null}
        expiresAt={profile?.pro_expires_at ?? null}
        activeComp={comps.find((c) => c.tier === 'pro') ?? null}
        granting={grantingTier === 'pro'}
        pending={pending}
        onGrantOpen={() => setGrantingTier('pro')}
        onGrantCancel={() => setGrantingTier(null)}
        onGrantSubmit={(exp, note) => handleGrant('pro', exp, note)}
        onRevoke={handleRevoke}
      />
    </div>
  )
}

function TierRow({
  label,
  active,
  source,
  expiresAt,
  activeComp,
  granting,
  pending,
  onGrantOpen,
  onGrantCancel,
  onGrantSubmit,
  onRevoke,
}: {
  tier: Tier
  label: string
  active: boolean
  source: string | null
  expiresAt: string | null
  activeComp: ActiveComp | null
  granting: boolean
  pending: boolean
  onGrantOpen: () => void
  onGrantCancel: () => void
  onGrantSubmit: (expiresAt: string, note: string) => Promise<void>
  onRevoke: (compId: string) => Promise<void>
}) {
  const [expires, setExpires] = useState('')
  const [note, setNote] = useState('')

  if (granting) {
    return (
      <div className="rounded-panel border border-hairline bg-paper p-2">
        <p className="text-xs font-semibold text-navy">Grant {label}</p>
        {/* Quick-pick durations per spec. Free-form date below still
            wins if the admin types one — last-write-wins via the
            same state. "Forever" clears the date. */}
        <div className="mt-2 flex gap-1">
          {[
            { label: '30d',     days: 30 },
            { label: '90d',     days: 90 },
            { label: 'Forever', days: null },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                if (opt.days === null) { setExpires(''); return }
                const d = new Date()
                d.setDate(d.getDate() + opt.days)
                setExpires(d.toISOString().slice(0, 10))
              }}
              className="flex-1 rounded-card border border-hairline px-2 py-1 text-xs text-muted hover:border-green/40 hover:text-green"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="mt-2 block text-xs text-muted">
          Expires (optional)
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="mt-0.5 block w-full rounded-card border border-hairline px-2 py-1 text-xs"
          />
        </label>
        <label className="mt-2 block text-xs text-muted">
          Note (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ambassador / beta tester / …"
            className="mt-0.5 block w-full rounded-card border border-hairline px-2 py-1 text-xs"
          />
        </label>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => void onGrantSubmit(expires, note)}
            disabled={pending}
            className="flex-1 rounded-card bg-green px-2 py-1 text-xs font-medium text-white hover:bg-green/90 disabled:opacity-50"
          >
            {pending ? 'Granting…' : 'Grant'}
          </button>
          <button
            type="button"
            onClick={onGrantCancel}
            disabled={pending}
            className="rounded-card border border-hairline px-2 py-1 text-xs text-muted hover:text-navy"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (active) {
    const isComp = source === 'comp' && activeComp !== null
    const isPaid = source === 'paid'
    return (
      <div className="flex items-center justify-between rounded-panel border border-hairline bg-white px-2 py-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-navy">{label}</span>
            <span className={`rounded-card px-1.5 py-0.5 text-[10px] font-medium ${
              isPaid ? 'bg-amber-100 text-amber-800' : 'bg-cream text-green'
            }`}>
              {isPaid ? 'Paid' : 'Comp'}
            </span>
          </div>
          {expiresAt && (
            <p className="mt-0.5 text-[11px] text-muted">
              Expires {new Date(expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {isComp && (
          <button
            type="button"
            onClick={() => void onRevoke(activeComp!.id)}
            disabled={pending}
            className="shrink-0 rounded-card border border-accent/40 px-2 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white disabled:opacity-50"
          >
            Revoke
          </button>
        )}
        {isPaid && (
          <span className="shrink-0 text-[10px] italic text-muted">
            billing-managed
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-panel border border-hairline bg-white px-2 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <button
        type="button"
        onClick={onGrantOpen}
        disabled={pending}
        className="rounded-card border border-green/40 px-2 py-1 text-xs font-medium text-green hover:bg-green hover:text-white disabled:opacity-50"
      >
        Grant
      </button>
    </div>
  )
}
