'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { Button } from './ui/Button'
import { spendTierLabel } from '@/lib/design/spend-tiers'

interface Props {
  onClose: () => void
}

type Step = 'validate' | 'spend' | 'pricing' | 'confirm' | 'published'

export function PublishFlow({ onClose }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const pages = usePassportStore((s) => s.pages)
  const stops = usePassportStore((s) => s.stops)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  const [step, setStep] = useState<Step>('validate')
  const [priceCents, setPriceCents] = useState(passport?.price_cents ?? 0)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!passport) return null

  // ── Validation checks ──────────────────────────────────────────────────────
  const stampPages = pages.filter((p) => p.page_type !== 'information')

  const validationIssues: string[] = []
  if (!passport.title.trim() || passport.title === 'Untitled Passport')
    validationIssues.push('Give your passport a real title.')
  if (pages.length === 0)
    validationIssues.push('Add at least one page.')
  if (stampPages.length === 0)
    validationIssues.push('Add at least one stamp page — information-only passports cannot be published.')
  if (stops.length === 0)
    validationIssues.push('Add at least one stop.')
  const stopsWithoutLocation = stops.filter((s) => !s.address_street && !s.lat)
  if (stopsWithoutLocation.length > 0)
    validationIssues.push(
      `${stopsWithoutLocation.length} stop(s) have no address or coordinates.`,
    )
  if (!passport.expected_spend_tier)
    validationIssues.push('Set an expected spend tier (Settings → Expected Spend).')

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('passports')
      .update({
        status: 'published',
        is_published: true,
        price_cents: priceCents,
        published_at: new Date().toISOString(),
      })
      .eq('id', passport.id)

    setPublishing(false)
    if (err) {
      setError(err.message)
      return
    }
    updatePassport({ status: 'published', is_published: true, price_cents: priceCents })
    setStep('published')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-modal border border-okuji-gray-2 bg-white shadow-2xl">
        <div className="border-b border-okuji-gray-2 px-5 py-4">
          <StepIndicator step={step} />
        </div>

        <div className="p-5">
          {step === 'validate' && (
            <ValidateStep
              issues={validationIssues}
              passport={passport}
              pageCount={pages.length}
              stopCount={stops.length}
              onContinue={() => setStep('spend')}
              onClose={onClose}
            />
          )}
          {step === 'spend' && (
            <SpendStep
              passport={passport}
              onContinue={() => setStep('pricing')}
              onBack={() => setStep('validate')}
            />
          )}
          {step === 'pricing' && (
            <PricingStep
              priceCents={priceCents}
              onChange={setPriceCents}
              onContinue={() => setStep('confirm')}
              onBack={() => setStep('spend')}
            />
          )}
          {step === 'confirm' && (
            <ConfirmStep
              passport={passport}
              priceCents={priceCents}
              stopCount={stops.length}
              publishing={publishing}
              error={error}
              onPublish={handlePublish}
              onBack={() => setStep('pricing')}
            />
          )}
          {step === 'published' && <PublishedStep passport={passport} onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}

// ── Steps ──────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ['validate', 'spend', 'pricing', 'confirm']
  const idx = steps.indexOf(step)
  const labels = ['Checklist', 'Spend', 'Pricing', 'Confirm']

  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              i < idx
                ? 'bg-okuji-teal text-white'
                : i === idx
                ? 'bg-okuji-navy text-white'
                : 'bg-okuji-gray-2 text-okuji-gray-3'
            }`}
          >
            {i < idx ? '✓' : i + 1}
          </div>
          <span
            className={`text-xs ${
              i === idx ? 'font-semibold text-okuji-navy' : 'text-okuji-gray-3'
            }`}
          >
            {label}
          </span>
          {i < labels.length - 1 && <span className="text-okuji-gray-2">›</span>}
        </div>
      ))}
    </div>
  )
}

function ValidateStep({
  issues,
  passport,
  pageCount,
  stopCount,
  onContinue,
  onClose,
}: {
  issues: string[]
  passport: ReturnType<typeof usePassportStore.getState>['passport']
  pageCount: number
  stopCount: number
  onContinue: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-okuji-navy">Before you publish</h2>
        <p className="mt-1 text-sm text-okuji-gray-3">
          {issues.length === 0 ? 'Everything looks good!' : `${issues.length} issue(s) to resolve.`}
        </p>
      </div>

      {issues.length > 0 ? (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={issue} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-okuji-coral">✗</span>
              <span className="text-okuji-navy">{issue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-1.5 rounded-panel bg-okuji-teal-lt px-4 py-3 text-sm">
          <div className="flex justify-between text-okuji-teal-dk">
            <span>Pages</span>
            <span className="font-semibold">{pageCount}</span>
          </div>
          <div className="flex justify-between text-okuji-teal-dk">
            <span>Stops</span>
            <span className="font-semibold">{stopCount}</span>
          </div>
          <div className="flex justify-between text-okuji-teal-dk">
            <span>Status</span>
            <span className="font-semibold capitalize">{passport?.status}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" className="flex-1" onClick={onContinue} disabled={issues.length > 0}>
          Continue →
        </Button>
      </div>
    </div>
  )
}

function SpendStep({
  passport,
  onContinue,
  onBack,
}: {
  passport: NonNullable<ReturnType<typeof usePassportStore.getState>['passport']>
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-okuji-navy">Spend confirmation</h2>
        <p className="mt-1 text-sm text-okuji-gray-3">
          You've set the expected spend as{' '}
          <strong>{spendTierLabel(passport.expected_spend_tier)}</strong>.
        </p>
      </div>

      <div className="rounded-panel border border-okuji-gray-2 px-4 py-3 text-sm text-okuji-navy">
        <p>
          By publishing, you confirm that a typical visitor completing all stops will spend
          approximately <strong>{spendTierLabel(passport.expected_spend_tier)}</strong>.
        </p>
        {passport.expected_spend_note && (
          <p className="mt-2 text-xs text-okuji-gray-3">{passport.expected_spend_note}</p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button size="sm" className="flex-1" onClick={onContinue}>
          Confirm →
        </Button>
      </div>
    </div>
  )
}

function PricingStep({
  priceCents,
  onChange,
  onContinue,
  onBack,
}: {
  priceCents: number
  onChange: (v: number) => void
  onContinue: () => void
  onBack: () => void
}) {
  const dollars = (priceCents / 100).toFixed(2)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-okuji-navy">Pricing</h2>
        <p className="mt-1 text-sm text-okuji-gray-3">
          Set a price collectors will pay to download this passport.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-okuji-navy">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={dollars}
            onChange={(e) =>
              onChange(Math.round(parseFloat(e.target.value || '0') * 100))
            }
            className="flex-1 rounded-panel border border-okuji-gray-2 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-okuji-teal"
          />
        </div>
        <p className="text-xs text-okuji-gray-3">Set to $0 for a free passport.</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button size="sm" className="flex-1" onClick={onContinue}>
          Next →
        </Button>
      </div>
    </div>
  )
}

function ConfirmStep({
  passport,
  priceCents,
  stopCount,
  publishing,
  error,
  onPublish,
  onBack,
}: {
  passport: NonNullable<ReturnType<typeof usePassportStore.getState>['passport']>
  priceCents: number
  stopCount: number
  publishing: boolean
  error: string | null
  onPublish: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-okuji-navy">Ready to publish?</h2>
        <p className="mt-1 text-sm text-okuji-gray-3">
          Review the summary below, then click Publish.
        </p>
      </div>

      <div className="rounded-panel border border-okuji-gray-2 divide-y divide-okuji-gray-2 text-sm">
        {[
          ['Title', passport.title],
          ['Stops', `${stopCount}`],
          ['Spend', spendTierLabel(passport.expected_spend_tier)],
          ['Price', priceCents === 0 ? 'Free' : `$${(priceCents / 100).toFixed(2)}`],
          [
            'Accessibility',
            [
              passport.transit_accessible ? 'Transit' : null,
              passport.wheelchair_accessible ? 'Wheelchair' : null,
            ]
              .filter(Boolean)
              .join(', ') || 'None noted',
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2">
            <span className="text-okuji-gray-3">{label}</span>
            <span className="font-medium text-okuji-navy">{value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-panel bg-okuji-coral/10 px-3 py-2 text-xs text-okuji-coral">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={publishing}>
          ← Back
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-okuji-teal hover:bg-okuji-teal-dk"
          onClick={onPublish}
          disabled={publishing}
        >
          {publishing ? 'Publishing…' : '🚀 Publish'}
        </Button>
      </div>
    </div>
  )
}

function PublishedStep({
  passport,
  onClose,
}: {
  passport: NonNullable<ReturnType<typeof usePassportStore.getState>['passport']>
  onClose: () => void
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-okuji-teal-lt text-4xl">
        🎉
      </div>
      <div>
        <h2 className="text-base font-semibold text-okuji-navy">Published!</h2>
        <p className="mt-1 text-sm text-okuji-gray-3">
          <strong>{passport.title}</strong> is now live.
        </p>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" className="flex-1" onClick={onClose}>
          Back to editor
        </Button>
      </div>
    </div>
  )
}
