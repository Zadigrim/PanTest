'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Pending transfers for one entity — both incoming and outgoing.
 *
 * "Acceptance stays with the recipient." This component never
 * renders an Accept button. The only writeable action here is
 * Cancel, which calls the existing cancel_passport_transfer RPC
 * (admin OR initiator per migration 051:336-340).
 */

type TransferRow = {
  id: string
  passport_id: string
  to_user_id: string | null
  to_institution_id: string | null
  initiated_by: string
  initiated_at: string
  status: string
  // Joined.
  passport: { id: string; title: string | null } | null
  to_user_profile: { display_name: string | null } | null
  to_institution: { id: string; name: string | null } | null
  initiator: { display_name: string | null } | null
}

export function PendingTransfersList({
  currentUserId,
  entity,
  canCancelOutgoing,
  isAdmin,
}: {
  currentUserId: string
  entity: { kind: 'person' | 'institution'; id: string }
  canCancelOutgoing: boolean
  isAdmin: boolean
}) {
  const [rows, setRows] = useState<TransferRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function load() {
    setError(null)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Query both directions. RLS already permits the page (we got
    // a count for this entity server-side), so this returns the
    // viewer's visible subset.
    const sel = 'id, passport_id, to_user_id, to_institution_id, initiated_by, initiated_at, status, passport:passports!passport_transfers_passport_id_fkey(id, title), to_user_profile:profiles!to_user_id(display_name), to_institution:institutions!to_institution_id(id, name), initiator:profiles!initiated_by(display_name)'

    let q = db.from('passport_transfers').select(sel).eq('status', 'pending')
    if (entity.kind === 'person') {
      q = q.or(`to_user_id.eq.${entity.id},initiated_by.eq.${entity.id}`)
    } else {
      q = q.eq('to_institution_id', entity.id)
    }
    const { data, error } = await q.order('initiated_at', { ascending: false })
    if (error) {
      // PostgREST returns "Could not find the table 'public.X' in the
      // schema cache" when the table doesn't exist yet OR the
      // PostgREST schema cache hasn't been reloaded after the
      // migration. Either way the actionable answer is to apply
      // migration 051 / reload the schema — not the raw error text.
      const isSchemaCacheMiss = /schema cache/i.test(error.message)
        && /passport_transfers/i.test(error.message)
      setError(
        isSchemaCacheMiss
          ? 'Transfers aren’t available yet — migration 051 hasn’t been applied to this environment’s database.'
          : error.message,
      )
    } else {
      setRows((data ?? []) as TransferRow[])
    }
  }

  useEffect(() => {
    void load()
    // entity-change refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.kind, entity.id])

  async function handleCancel(id: string) {
    if (!window.confirm('Cancel this transfer offer? The recipient will no longer see it.')) return
    setCancelling(id)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('cancel_passport_transfer', {
        p_transfer_id: id,
      })
      if (error) {
        window.alert(error.message)
        return
      }
      await load()
    } finally {
      setCancelling(null)
    }
  }

  if (error) return <p className="text-[12px] text-red">{error}</p>
  if (rows === null) return <p className="text-[12px] text-muted">Loading…</p>
  if (rows.length === 0) {
    return <p className="text-[12px] text-muted">No pending transfers.</p>
  }

  // Bucket by direction (relative to this entity).
  const outgoing: TransferRow[] = []
  const incoming: TransferRow[] = []
  for (const t of rows) {
    const isOutgoing =
      entity.kind === 'person'
        ? t.initiated_by === entity.id
        : false  // institutions don't initiate; they only receive
    ;(isOutgoing ? outgoing : incoming).push(t)
  }

  return (
    <div className="space-y-3">
      {outgoing.length > 0 && (
        <Bucket label="Outgoing">
          {outgoing.map((t) => (
            <Row
              key={t.id}
              row={t}
              direction="out"
              showCancel={canCancelOutgoing && (isAdmin || t.initiated_by === currentUserId)}
              onCancel={() => handleCancel(t.id)}
              cancelling={cancelling === t.id}
            />
          ))}
        </Bucket>
      )}
      {incoming.length > 0 && (
        <Bucket label="Incoming">
          {incoming.map((t) => (
            <Row
              key={t.id}
              row={t}
              direction="in"
              showCancel={false}
              onCancel={() => {/* noop */}}
              cancelling={false}
            />
          ))}
        </Bucket>
      )}
    </div>
  )
}

function Bucket({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">{label}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  )
}

function Row({
  row,
  direction,
  showCancel,
  onCancel,
  cancelling,
}: {
  row: TransferRow
  direction: 'in' | 'out'
  showCancel: boolean
  onCancel: () => void
  cancelling: boolean
}) {
  const passportTitle = row.passport?.title ?? 'a passport'
  const recipient =
    row.to_user_profile?.display_name ?? row.to_institution?.name ?? 'recipient'
  const initiator = row.initiator?.display_name ?? 'someone'

  return (
    <li className="flex items-center justify-between gap-3 rounded-[6px] border border-surface-faintdiv px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] text-ink">
          {direction === 'out'
            ? <><span className="font-semibold">&ldquo;{passportTitle}&rdquo;</span> → {recipient}</>
            : <>{initiator} → <span className="font-semibold">&ldquo;{passportTitle}&rdquo;</span></>}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted">
          {direction === 'out'
            ? 'awaiting their acceptance'
            : 'pending'}
        </p>
      </div>
      {showCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="shrink-0 rounded-[6px] border-[1.5px] border-red bg-white px-2.5 py-1 text-[11px] font-semibold text-red hover:bg-red hover:text-white disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Cancel'}
        </button>
      ) : null}
    </li>
  )
}
