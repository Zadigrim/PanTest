'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  setCapabilities,
  setMerchantStatus,
  setSubscription,
  setComp,
} from '../actions'
import type { ActionResult } from '../types'

interface Authorization {
  userId: string
  displayName: string
  canVerify: boolean
  canDistributePrizes: boolean
}

interface Props {
  merchant: {
    id: string
    status: string
    moichidoTier: string | null
    moichidoCardLimit: number | null
    moichidoRecordedAmountCents: number | null
  }
  authorizations: Authorization[]
  comp: { active: boolean; note: string | null; expiresAt: string | null }
}

const card = 'rounded-[12px] border border-moichido-hairline bg-white p-5'
const h = 'text-sm font-semibold uppercase tracking-wide text-moichido-muted'
const input =
  'h-8 rounded-[8px] border border-moichido-hairline bg-white px-2 text-sm text-moichido-ink focus:outline-none focus:ring-2 focus:ring-moichido-teal'
const btn =
  'rounded-[8px] bg-moichido-teal px-3 py-1.5 text-sm font-semibold text-moichido-paper hover:opacity-90 disabled:opacity-50'

function Note({ result }: { result: ActionResult | null }) {
  if (!result) return null
  return result.ok ? (
    <span className="text-xs text-moichido-teal">Saved.</span>
  ) : (
    <span className="text-xs text-moichido-apricot">{result.error}</span>
  )
}

export function MerchantForms({ merchant, authorizations, comp }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()

  // Subscription
  const [tier, setTier] = useState(merchant.moichidoTier ?? '')
  const [cardLimit, setCardLimit] = useState(
    merchant.moichidoCardLimit != null ? String(merchant.moichidoCardLimit) : '',
  )
  const [amount, setAmount] = useState(
    merchant.moichidoRecordedAmountCents != null
      ? (merchant.moichidoRecordedAmountCents / 100).toFixed(2)
      : '',
  )
  const [subResult, setSubResult] = useState<ActionResult | null>(null)

  // Comp
  const [comped, setComped] = useState(comp.active)
  const [compNote, setCompNote] = useState(comp.note ?? '')
  const [compExpires, setCompExpires] = useState(comp.expiresAt?.slice(0, 10) ?? '')
  const [compResult, setCompResult] = useState<ActionResult | null>(null)

  const [statusResult, setStatusResult] = useState<ActionResult | null>(null)
  const [capResult, setCapResult] = useState<Record<string, ActionResult | null>>({})

  const run = (fn: () => Promise<ActionResult>, set: (r: ActionResult | null) => void) =>
    start(async () => {
      set(await fn())
      router.refresh()
    })

  return (
    <div className="space-y-4">
      {/* Access — capability flags per owner */}
      <section className={card}>
        <h2 className={h}>Access</h2>
        <div className="mt-3 space-y-3">
          {authorizations.length === 0 && (
            <p className="text-sm text-moichido-muted">No linked accounts.</p>
          )}
          {authorizations.map((a) => (
            <CapabilityRow
              key={a.userId}
              auth={a}
              pending={pending}
              result={capResult[a.userId] ?? null}
              onSave={(canVerify, canDistributePrizes) =>
                run(
                  () => setCapabilities({ institutionId: merchant.id, userId: a.userId, canVerify, canDistributePrizes }),
                  (r) => setCapResult((prev) => ({ ...prev, [a.userId]: r })),
                )
              }
            />
          ))}
        </div>
      </section>

      {/* Status — suspend / reactivate */}
      <section className={card}>
        <h2 className={h}>Status</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-moichido-ink">
            {merchant.status === 'suspended' ? 'Suspended' : 'Active'}
          </span>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              run(
                () => setMerchantStatus({
                  institutionId: merchant.id,
                  status: merchant.status === 'suspended' ? 'active' : 'suspended',
                }),
                setStatusResult,
              )
            }
          >
            {merchant.status === 'suspended' ? 'Reactivate' : 'Suspend'}
          </button>
          <Note result={statusResult} />
        </div>
        <p className="mt-2 text-xs text-moichido-muted">
          Suspended merchants can&apos;t mint new cards. History is preserved.
        </p>
      </section>

      {/* Subscription — tier, card limit, recorded amount (no live billing) */}
      <section className={card}>
        <h2 className={h}>Subscription</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-xs text-moichido-muted">
            Tier
            <input className={input} value={tier} onChange={(e) => setTier(e.target.value)} placeholder="e.g. starter" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-moichido-muted">
            Card limit (blank = unlimited)
            <input className={input} type="number" min={0} value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-moichido-muted">
            Recorded monthly (USD)
            <input className={input} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              run(
                () => setSubscription({
                  institutionId: merchant.id,
                  tier: tier.trim() || null,
                  cardLimit: cardLimit === '' ? null : Number(cardLimit),
                  recordedAmountCents: amount === '' ? null : Math.round(Number(amount) * 100),
                }),
                setSubResult,
              )
            }
          >
            Save subscription
          </button>
          <Note result={subResult} />
        </div>
        <p className="mt-2 text-xs text-moichido-muted">Recorded value only — no charge is made.</p>
      </section>

      {/* Comp — via comp_subscriptions (institution-scoped) */}
      <section className={card}>
        <h2 className={h}>Comp</h2>
        <label className="mt-3 flex items-center gap-2 text-sm text-moichido-ink">
          <input type="checkbox" checked={comped} onChange={(e) => setComped(e.target.checked)} />
          Comped (no recorded charge)
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-moichido-muted">
            Note
            <input className={input} value={compNote} onChange={(e) => setCompNote(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-moichido-muted">
            Expires (blank = never)
            <input className={input} type="date" value={compExpires} onChange={(e) => setCompExpires(e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              run(
                () => setComp({
                  institutionId: merchant.id,
                  comped,
                  note: compNote,
                  expiresAt: compExpires ? new Date(compExpires).toISOString() : null,
                }),
                setCompResult,
              )
            }
          >
            Save comp
          </button>
          <Note result={compResult} />
        </div>
      </section>
    </div>
  )
}

function CapabilityRow({
  auth,
  pending,
  result,
  onSave,
}: {
  auth: Authorization
  pending: boolean
  result: ActionResult | null
  onSave: (canVerify: boolean, canDistributePrizes: boolean) => void
}) {
  const [canVerify, setCanVerify] = useState(auth.canVerify)
  const [canDistribute, setCanDistribute] = useState(auth.canDistributePrizes)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[8px] border border-moichido-hairline/60 p-3">
      <span className="text-sm font-medium text-moichido-ink">{auth.displayName}</span>
      <label className="flex items-center gap-1.5 text-xs text-moichido-muted">
        <input type="checkbox" checked={canVerify} onChange={(e) => setCanVerify(e.target.checked)} />
        Issue / verify
      </label>
      <label className="flex items-center gap-1.5 text-xs text-moichido-muted">
        <input type="checkbox" checked={canDistribute} onChange={(e) => setCanDistribute(e.target.checked)} />
        Redeem / distribute
      </label>
      <button
        type="button"
        disabled={pending}
        className="rounded-[8px] border border-moichido-teal px-2.5 py-1 text-xs font-semibold text-moichido-teal hover:bg-moichido-teal/10 disabled:opacity-50"
        onClick={() => onSave(canVerify, canDistribute)}
      >
        Save
      </button>
      <Note result={result} />
    </div>
  )
}
