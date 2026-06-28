'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { safeUpdate } from '@/lib/design/persist'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { SPEND_TIERS, spendTierLabel } from '@/lib/design/spend-tiers'
import { PrintOptionsDialog } from './PrintOptionsDialog'
import type { SpendTier, CreatorDecision } from '@/lib/design/types'

interface Props {
  onClose: () => void
}

interface VerifyResult {
  suggested_tier: SpendTier
  range_low: number
  range_high: number
  reasoning: string
  per_stop: Array<{
    name: string
    estimated_low: number
    estimated_high: number
    note: string
  }>
  tier_match: boolean
  requested_tier: SpendTier
}

export function PassportSettingsPanel({ onClose }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [decision, setDecision] = useState<CreatorDecision | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  if (!passport) return null

  const persist = async (patch: Parameters<typeof updatePassport>[0]) => {
    updatePassport(patch)
  }

  const handleVerifySpend = async () => {
    if (!passport.expected_spend_tier) {
      alert('Select an expected spend tier first.')
      return
    }
    setVerifying(true)
    setVerifyResult(null)
    setVerifyError(null)
    setDecision(null)

    try {
      const res = await fetch('/api/verify-spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passportId: passport.id,
          requestedTier: passport.expected_spend_tier,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setVerifyResult(await res.json())
    } catch (e) {
      setVerifyError(String(e))
    } finally {
      setVerifying(false)
    }
  }

  const handleDecision = async (d: CreatorDecision) => {
    setDecision(d)
    if (d === 'adjusted' && verifyResult) {
      await persist({ expected_spend_tier: verifyResult.suggested_tier })
    }
    // Log decision
    const supabase = createClient()
    const { data: latest } = await supabase
      .from('spend_verification_log')
      .select('id')
      .eq('passport_id', passport.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (latest) {
      await supabase
        .from('spend_verification_log')
        .update({ creator_decision: d })
        .eq('id', latest.id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-[400px] flex-col overflow-y-auto border-l border-hairline bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-base font-semibold text-navy">Passport Settings</h2>
          <button
            onClick={onClose}
            className="text-lg text-muted hover:text-navy transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {/* Basic info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Details
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-muted">Title</Label>
              <Input
                value={passport.title}
                onChange={(e) => updatePassport({ title: e.target.value })}
                onBlur={(e) => persist({ title: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted">Description</Label>
              <textarea
                value={passport.description ?? ''}
                onChange={(e) => updatePassport({ description: e.target.value })}
                onBlur={(e) => persist({ description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-panel border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                placeholder="Describe this passport experience…"
              />
            </div>
          </section>

          {/* Passport-completion prize (migration 098). A passport-level reward
              redeemed through the SAME terminal flow as page prizes — the code
              is issued automatically (server-side) once a holder has stamped
              every stop across all pages. Leave blank for no completion prize.
              (The credential-type choice was removed: the okuji passport
              designer always operates as a stamp passport; the consumable/
              loyalty path lives in the moichido card designer.) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Completion prize
            </h3>
            <div className="space-y-2">
              <Label className="text-xs text-muted">Reward for stamping every stop (optional)</Label>
              <textarea
                value={passport.completion_prize_description ?? ''}
                onChange={(e) => updatePassport({ completion_prize_description: e.target.value })}
                onBlur={(e) => persist({ completion_prize_description: e.target.value.trim() || null })}
                rows={2}
                className="w-full resize-none rounded-panel border border-hairline px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green"
                placeholder="e.g. A free coffee at any participating shop"
              />
              <p className="text-xs text-muted">
                Redeems through the same terminal as page prizes. The code is issued automatically
                when a collector has stamped every stop across all pages. Leave blank for none.
              </p>
              {(passport.completion_prize_description ?? '').trim() !== '' && (
                <div className="space-y-1 pt-1">
                  <Label className="text-xs text-muted">Prize value (optional, USD)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      passport.completion_prize_value_cents != null
                        ? (passport.completion_prize_value_cents / 100).toString()
                        : ''
                    }
                    onChange={(e) => {
                      const d = e.target.value
                      const n = Number(d)
                      updatePassport({
                        completion_prize_value_cents:
                          d === '' || !Number.isFinite(n) ? null : Math.round(n * 100),
                      })
                    }}
                    onBlur={(e) => {
                      const d = e.target.value
                      const n = Number(d)
                      persist({
                        completion_prize_value_cents:
                          d === '' || !Number.isFinite(n) ? null : Math.round(n * 100),
                      })
                    }}
                    className="h-8 w-28 text-sm"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Completion threshold (migration 106). How many stops a collector
                  must stamp to be OFFERED completion. Below it they keep
                  collecting; at it they may choose to complete (firing the prize);
                  at 100% it completes automatically. Blank = require every stop. */}
              <div className="space-y-1 border-t border-hairline pt-3">
                <Label className="text-xs text-muted">Completion threshold (optional)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={passport.completion_required_stops != null ? String(passport.completion_required_stops) : ''}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    updatePassport({ completion_required_stops: e.target.value === '' || !Number.isFinite(n) || n < 1 ? null : n })
                  }}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10)
                    persist({ completion_required_stops: e.target.value === '' || !Number.isFinite(n) || n < 1 ? null : n })
                  }}
                  className="h-8 w-28 text-sm"
                  placeholder="all stops"
                />
                <p className="text-xs text-muted">
                  Stops required before a collector is offered completion (e.g. 9 of 10). At the
                  threshold they can choose to complete; at 100% it completes automatically. Leave
                  blank to require every stop.
                </p>
              </div>
            </div>
          </section>

          {/* Cover */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Cover
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-muted">Emblem (emoji)</Label>
              <Input
                value={passport.cover_emblem ?? ''}
                onChange={(e) => updatePassport({ cover_emblem: e.target.value })}
                onBlur={(e) => persist({ cover_emblem: e.target.value })}
                className="h-8 text-lg"
                maxLength={4}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted">Paper color (hex, no #)</Label>
              <div className="flex gap-2">
                <Input
                  value={passport.cover_paper_color ?? 'F5F2EC'}
                  maxLength={6}
                  onChange={(e) => updatePassport({ cover_paper_color: e.target.value })}
                  onBlur={(e) => persist({ cover_paper_color: e.target.value })}
                  className="h-8 flex-1 font-mono text-sm uppercase"
                />
                <div
                  className="h-8 w-8 shrink-0 rounded-card border border-hairline"
                  style={{ backgroundColor: `#${passport.cover_paper_color ?? 'F5F2EC'}` }}
                />
              </div>
            </div>
          </section>

          {/* Accessibility */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Accessibility
            </h3>
            <div className="space-y-2">
              {[
                { key: 'transit_accessible', label: '🚌 Transit accessible' },
                { key: 'wheelchair_accessible', label: '♿ Wheelchair accessible' },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(passport[key as keyof typeof passport])}
                    onChange={(e) => persist({ [key]: e.target.checked })}
                    className="h-4 w-4 rounded accent-green"
                  />
                  <span className="text-sm text-navy">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Print for kids — institutional accounts only */}
          {passport.institution_id && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Print for kids
              </h3>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={passport.print_enabled ?? false}
                  onChange={(e) => persist({ print_enabled: e.target.checked })}
                  className="h-4 w-4 rounded accent-green"
                />
                <span className="text-sm text-navy">
                  Enable physical passport printing for this passport
                </span>
              </label>

              {/* Journal lines used to be rendered on stop pages, controlled
                  by a per-passport / per-stop toggle. The "lines layered onto
                  stop pages" mechanism has been retired — future journal-line
                  support will land as dedicated journal pages, not as an
                  overlay on stop pages, so the old toggles were removed
                  outright instead of left dormant. */}

              {passport.print_enabled && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setPrintOpen(true)}
                  >
                    Print for kids
                  </Button>
                  <PrintOptionsDialog
                    passport={{ id: passport.id, title: passport.title }}
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                  />
                </>
              )}
            </section>
          )}

          {/* Per-copy serial + optional expiry (M2 follow-up) */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Per-copy serial &amp; expiry
            </h3>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={passport.show_copy_number ?? false}
                onChange={(e) => persist({ show_copy_number: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded accent-green"
              />
              <span className="text-sm text-navy">
                Show copy number on artwork
                <span className="mt-0.5 block text-xs italic text-muted">
                  Add a text element with <code className="rounded bg-paper px-1 py-0.5 text-[10.5px]">{'{{copy_number}}'}</code> to position
                  the holder&rsquo;s serial. When this is off the token
                  is ignored at render.
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-navy">
                Expiry duration (days)
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="Blank = never expires"
                value={passport.expiry_duration_days ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  const next = raw === '' ? null : Math.max(1, parseInt(raw, 10) || 0)
                  persist({ expiry_duration_days: next })
                }}
                className="h-9 w-full"
              />
              <p className="text-xs italic text-muted">
                Each acquired copy stores its own expiry date at acquisition,
                so changing this number affects future copies only —
                existing holders keep the duration they were issued.
              </p>
            </div>
          </section>

          {/* Spend tier + AI verification */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Expected Spend
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {SPEND_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => persist({ expected_spend_tier: tier.value })}
                  className={`rounded-card border py-2 text-sm transition-colors ${
                    passport.expected_spend_tier === tier.value
                      ? 'border-green bg-cream font-medium text-green'
                      : 'border-hairline text-muted hover:border-green/40'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted">Spend note (optional)</Label>
              <Input
                value={passport.expected_spend_note ?? ''}
                placeholder="e.g. Includes one meal"
                onChange={(e) => updatePassport({ expected_spend_note: e.target.value })}
                onBlur={(e) => persist({ expected_spend_note: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleVerifySpend}
              disabled={verifying}
            >
              {verifying ? 'Analyzing stops…' : '✨ Verify with AI'}
            </Button>

            {verifyError && (
              <p className="rounded-panel bg-accent/10 px-3 py-2 text-xs text-accent">
                {verifyError}
              </p>
            )}

            {verifyResult && !decision && (
              <VerifyResultCard result={verifyResult} onDecision={handleDecision} />
            )}

            {decision && verifyResult && (
              <div className="rounded-panel bg-cream px-3 py-2 text-xs text-green">
                Decision recorded:{' '}
                <strong className="capitalize">{decision}</strong>.
                {decision === 'adjusted'
                  ? ` Tier updated to ${spendTierLabel(verifyResult.suggested_tier)}.`
                  : decision === 'accepted'
                  ? ' Your tier is confirmed accurate.'
                  : ' You kept your original tier.'}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function VerifyResultCard({
  result,
  onDecision,
}: {
  result: VerifyResult
  onDecision: (d: CreatorDecision) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-panel border px-3 py-3 text-sm space-y-2 ${
        result.tier_match
          ? 'border-green bg-cream'
          : 'border-accent bg-accent/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`font-semibold ${
              result.tier_match ? 'text-green' : 'text-accent'
            }`}
          >
            {result.tier_match ? '✓ Tier confirmed' : '⚠ Tier mismatch'}
          </p>
          <p className="text-xs text-muted">
            AI suggests: {spendTierLabel(result.suggested_tier)} ($
            {result.range_low}–${result.range_high})
          </p>
        </div>
      </div>

      <p className="text-xs text-navy">{result.reasoning}</p>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-green hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} per-stop breakdown
      </button>

      {expanded && result.per_stop.length > 0 && (
        <div className="space-y-1 border-t border-hairline pt-2">
          {result.per_stop.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-navy">{s.name}</span>
              <span className="shrink-0 text-muted">
                ${s.estimated_low}–${s.estimated_high}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-hairline pt-2">
        <Button size="sm" className="flex-1 text-xs" onClick={() => onDecision('accepted')}>
          Accept my tier
        </Button>
        {!result.tier_match && (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 text-xs"
            onClick={() => onDecision('adjusted')}
          >
            Use AI suggestion
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-xs"
          onClick={() => onDecision('overridden')}
        >
          Keep mine
        </Button>
      </div>
    </div>
  )
}
