'use client'

import { useEffect, useState } from 'react'
import { RingMark } from '@/components/moichido/marks/RingMark'
import { issuePunch, redeemPunchCard } from '@/app/moichido/(authed)/terminal/actions'
import type { IssueResult } from '@/app/moichido/(authed)/terminal/types'

export interface TerminalCard {
  id: string
  title: string
  targetCount: number
}

interface Props {
  cards: TerminalCard[]
  canVerify: boolean
  canDistribute: boolean
}

/**
 * Counter-facing terminal. Two capability-gated halves, both driving
 * the M3 functions through server actions (no /api/m3/* fetch — that's
 * host-gated off on moichido). moichido chrome only.
 */
export function TerminalClient({ cards, canVerify, canDistribute }: Props) {
  if (!canVerify && !canDistribute) {
    return (
      <div className="rounded-[12px] border border-moichido-hairline bg-white p-8 text-center">
        <p className="text-sm font-medium text-moichido-ink">No terminal permissions</p>
        <p className="mt-1 text-xs text-moichido-muted">
          Ask an administrator for verify or prize-distribution access to use the terminal.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canVerify && <IssuePanel cards={cards} />}
      {canDistribute && <RedeemPanel />}
    </div>
  )
}

// ── Issue half ─────────────────────────────────────────────────────────────

function IssuePanel({ cards }: { cards: TerminalCard[] }) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssueResult | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Countdown to token expiry.
  useEffect(() => {
    if (!issued?.expiresAtMs) return
    const tick = () => setSecondsLeft(Math.max(0, Math.round((issued.expiresAtMs! - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [issued])

  async function handleIssue() {
    if (!cardId || busy) return
    setBusy(true)
    setError(null)
    setIssued(null)
    try {
      const res = await issuePunch(cardId)
      if (res.ok) setIssued(res)
      else setError(res.error ?? 'Could not issue a punch.')
    } finally {
      setBusy(false)
    }
  }

  const expired = issued != null && secondsLeft <= 0

  return (
    <section className="rounded-[12px] border border-moichido-hairline bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="text-moichido-teal"><RingMark size={20} strokeWidth={2.6} /></span>
        <h2 className="text-sm font-semibold text-moichido-ink">Issue a punch</h2>
      </div>

      {cards.length === 0 ? (
        <p className="mt-4 text-sm text-moichido-muted">
          No punch cards yet. Create one before issuing punches.
        </p>
      ) : (
        <>
          {cards.length > 1 && (
            <label className="mt-4 block text-xs font-medium text-moichido-ink">
              Card
              <select
                value={cardId}
                onChange={(e) => { setCardId(e.target.value); setIssued(null); setError(null) }}
                className="mt-1 w-full rounded-[8px] border border-moichido-hairline bg-white px-3 py-2 text-sm text-moichido-ink"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} · {c.targetCount}-punch</option>
                ))}
              </select>
            </label>
          )}

          {!issued && (
            <>
              <p className="mt-4 text-sm text-moichido-muted">
                Generates a single-use QR. The customer scans it to add one punch to their card.
              </p>
              <button
                type="button"
                onClick={handleIssue}
                disabled={busy || !cardId}
                className="mt-4 w-full rounded-[8px] bg-moichido-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Issuing…' : 'Issue punch'}
              </button>
            </>
          )}

          {issued?.qrDataUrl && (
            <div className="mt-5 flex flex-col items-center">
              <div className={`rounded-[12px] border border-moichido-hairline p-3 ${expired ? 'opacity-30' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={issued.qrDataUrl} alt="Punch QR code" width={220} height={220} />
              </div>
              {expired ? (
                <p className="mt-3 text-xs font-medium text-moichido-ink">Expired — issue another.</p>
              ) : (
                <p className="mt-3 text-xs text-moichido-muted">
                  Ask the customer to scan. Expires in <span className="font-semibold text-moichido-ink">{secondsLeft}s</span>.
                </p>
              )}
              <code className="mt-2 break-all text-center text-[10px] text-moichido-muted">{issued.token}</code>
              <button
                type="button"
                onClick={handleIssue}
                disabled={busy}
                className="mt-4 w-full rounded-[8px] border border-moichido-hairline bg-white px-4 py-2 text-xs font-semibold text-moichido-ink hover:bg-moichido-paper disabled:opacity-40"
              >
                {busy ? 'Issuing…' : 'Issue another'}
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-xs font-medium text-moichido-apricot">{error}</p>}
        </>
      )}
    </section>
  )
}

// ── Redeem half ────────────────────────────────────────────────────────────

function RedeemPanel() {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [extra, setExtra] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleRedeem() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const extraCents = extra.trim() ? Math.round(Number(extra) * 100) : undefined
      const res = await redeemPunchCard(code, note || undefined, Number.isFinite(extraCents) ? extraCents : undefined)
      if (res.ok) {
        setDone(true)
        setConfirming(false)
        setCode(''); setNote(''); setExtra('')
      } else {
        setError(res.error ?? 'Redemption failed.')
        setConfirming(false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="rounded-[12px] border border-moichido-hairline bg-white p-6">
        <h2 className="text-sm font-semibold text-moichido-ink">Prize distributed</h2>
        <p className="mt-2 text-sm text-moichido-muted">
          The card was redeemed and the distribution logged. A fresh card was issued automatically
          if this card reissues on completion.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-4 w-full rounded-[8px] bg-moichido-teal px-4 py-2.5 text-sm font-semibold text-white"
        >
          Redeem another
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-[12px] border border-moichido-hairline bg-white p-6">
      <h2 className="text-sm font-semibold text-moichido-ink">Redeem a card</h2>
      <p className="mt-1 text-sm text-moichido-muted">
        Enter the completion code from the customer&apos;s finished card to distribute the prize.
      </p>

      <label className="mt-4 block text-xs font-medium text-moichido-ink">
        Completion code
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(null) }}
          placeholder="OKJ-XXXX-XX"
          className="mt-1 w-full rounded-[8px] border border-moichido-hairline px-3 py-2 font-mono text-sm uppercase text-moichido-ink"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-moichido-ink">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-[8px] border border-moichido-hairline px-3 py-2 text-sm text-moichido-ink"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-moichido-ink">
        Extra gift card $ (optional)
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1 w-full rounded-[8px] border border-moichido-hairline px-3 py-2 text-sm text-moichido-ink"
        />
      </label>

      {!confirming ? (
        <button
          type="button"
          onClick={() => { if (code.trim()) setConfirming(true); else setError('Enter a completion code.') }}
          disabled={busy}
          className="mt-4 w-full rounded-[8px] bg-moichido-teal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Redeem &amp; distribute
        </button>
      ) : (
        <div className="mt-4 rounded-[8px] border border-moichido-hairline bg-moichido-paper p-3">
          <p className="text-xs text-moichido-ink">
            Distribute the prize for <span className="font-mono font-semibold">{code.trim().toUpperCase()}</span> and
            mark the card redeemed? This can&apos;t be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRedeem}
              disabled={busy}
              className="flex-1 rounded-[8px] bg-moichido-teal px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Distributing…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-[8px] border border-moichido-hairline bg-white px-4 py-2 text-xs font-semibold text-moichido-ink disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs font-medium text-moichido-apricot">{error}</p>}
    </section>
  )
}
