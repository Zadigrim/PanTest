'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Label } from './ui/Label'
import { SPEND_TIERS, spendTierLabel } from '@/lib/design/spend-tiers'
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

  if (!passport) return null

  const persist = async (patch: Parameters<typeof updatePassport>[0]) => {
    updatePassport(patch)
    const supabase = createClient()
    await supabase.from('passports').update(patch).eq('id', passport.id)
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
      <div className="relative z-10 flex h-full w-[400px] flex-col overflow-y-auto border-l border-panoply-gray-2 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-panoply-gray-2 px-5 py-4">
          <h2 className="text-base font-semibold text-panoply-navy">Passport Settings</h2>
          <button
            onClick={onClose}
            className="text-lg text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {/* Basic info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
              Details
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-panoply-gray-3">Title</Label>
              <Input
                value={passport.title}
                onChange={(e) => updatePassport({ title: e.target.value })}
                onBlur={(e) => persist({ title: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-panoply-gray-3">Description</Label>
              <textarea
                value={passport.description ?? ''}
                onChange={(e) => updatePassport({ description: e.target.value })}
                onBlur={(e) => persist({ description: e.target.value })}
                rows={3}
                className="w-full resize-none rounded-panel border border-panoply-gray-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-panoply-teal"
                placeholder="Describe this passport experience…"
              />
            </div>
          </section>

          {/* Cover */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
              Cover
            </h3>
            <div className="space-y-1">
              <Label className="text-xs text-panoply-gray-3">Emblem (emoji)</Label>
              <Input
                value={passport.cover_emblem ?? '🧭'}
                onChange={(e) => updatePassport({ cover_emblem: e.target.value })}
                onBlur={(e) => persist({ cover_emblem: e.target.value })}
                className="h-8 text-lg"
                maxLength={4}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-panoply-gray-3">Paper color (hex, no #)</Label>
              <div className="flex gap-2">
                <Input
                  value={passport.cover_paper_color ?? 'F5F2EC'}
                  maxLength={6}
                  onChange={(e) => updatePassport({ cover_paper_color: e.target.value })}
                  onBlur={(e) => persist({ cover_paper_color: e.target.value })}
                  className="h-8 flex-1 font-mono text-sm uppercase"
                />
                <div
                  className="h-8 w-8 shrink-0 rounded-card border border-panoply-gray-2"
                  style={{ backgroundColor: `#${passport.cover_paper_color ?? 'F5F2EC'}` }}
                />
              </div>
            </div>
          </section>

          {/* Accessibility */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
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
                    className="h-4 w-4 rounded accent-panoply-teal"
                  />
                  <span className="text-sm text-panoply-navy">{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Spend tier + AI verification */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-panoply-gray-3">
              Expected Spend
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {SPEND_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  onClick={() => persist({ expected_spend_tier: tier.value })}
                  className={`rounded-card border py-2 text-sm transition-colors ${
                    passport.expected_spend_tier === tier.value
                      ? 'border-panoply-teal bg-panoply-teal-lt font-medium text-panoply-teal-dk'
                      : 'border-panoply-gray-2 text-panoply-gray-3 hover:border-panoply-teal/40'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-panoply-gray-3">Spend note (optional)</Label>
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
              <p className="rounded-panel bg-panoply-coral/10 px-3 py-2 text-xs text-panoply-coral">
                {verifyError}
              </p>
            )}

            {verifyResult && !decision && (
              <VerifyResultCard result={verifyResult} onDecision={handleDecision} />
            )}

            {decision && verifyResult && (
              <div className="rounded-panel bg-panoply-teal-lt px-3 py-2 text-xs text-panoply-teal-dk">
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
          ? 'border-panoply-teal bg-panoply-teal-lt'
          : 'border-panoply-amber bg-panoply-amber/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className={`font-semibold ${
              result.tier_match ? 'text-panoply-teal-dk' : 'text-panoply-amber'
            }`}
          >
            {result.tier_match ? '✓ Tier confirmed' : '⚠ Tier mismatch'}
          </p>
          <p className="text-xs text-panoply-gray-3">
            AI suggests: {spendTierLabel(result.suggested_tier)} ($
            {result.range_low}–${result.range_high})
          </p>
        </div>
      </div>

      <p className="text-xs text-panoply-navy">{result.reasoning}</p>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-panoply-teal-dk hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} per-stop breakdown
      </button>

      {expanded && result.per_stop.length > 0 && (
        <div className="space-y-1 border-t border-panoply-gray-2 pt-2">
          {result.per_stop.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-panoply-navy">{s.name}</span>
              <span className="shrink-0 text-panoply-gray-3">
                ${s.estimated_low}–${s.estimated_high}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-panoply-gray-2 pt-2">
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
