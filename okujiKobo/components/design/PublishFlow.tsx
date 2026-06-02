'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import type { DesignerStop } from '@/lib/design/types'
import { Button } from './ui/Button'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import { isStudio, type SubscriptionFields } from '@/lib/roles'

interface Props {
  onClose: () => void
}

// Returns 'coords' / 'address' if the stop's canonical type + method
// require a location field it doesn't have, or null if the stop is
// fine. Honor / Event-Activity stops always return null because they
// have no location by design. Logic mirrors the right-inspector's
// deriveExpType/deriveMethod so the two paths agree on the model.
type StopLocationIssue = 'coords' | 'address' | null

function stopLocationIssue(stop: DesignerStop): StopLocationIssue {
  const expType =
    stop.experience_type === 'experience' ? 'experience'
    : stop.experience_type === 'location' ? 'location'
    // Legacy fallback: pre-046 rows that never got backfilled.
    : stop.verification_tier === 5 ? 'experience'
    : 'location'
  if (expType === 'experience') return null

  const m = stop.experience_verification_method
  const method =
    m === 'gps' || m === 'qr' || m === 'witnessed' || m === 'documented' ? m
    : stop.verification_tier === 3 ? 'gps'
    : stop.verification_tier === 1 || stop.verification_tier === 2 ? 'qr'
    : stop.verification_tier === 4 ? 'witnessed'
    : 'gps'

  if (method === 'gps') {
    // typeof check rather than truthiness so lat=0 / lng=0 (equator,
    // prime meridian) counts as set.
    const hasCoords = typeof stop.lat === 'number' && typeof stop.lng === 'number'
    return hasCoords ? null : 'coords'
  }
  if (method === 'qr') {
    const hasAddress = !!(stop.address_street?.trim() || stop.address_city?.trim())
    return hasAddress ? null : 'address'
  }
  // witnessed / documented: location is OPTIONAL — never block.
  return null
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
  // Pre-flight: fetch the current user's subscription state once so the
  // validate step can surface the Studio gate up-front instead of leaving
  // it for the trigger to throw at publish time. The trigger is still the
  // real enforcement; this just turns a confusing error into clear UX.
  const [actorStudio, setActorStudio] = useState<boolean | null>(null)
  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setActorStudio(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('studio_status, studio_expires_at')
        .eq('id', user.id)
        .single()
      setActorStudio(isStudio((data ?? null) as SubscriptionFields | null))
    })()
  }, [])

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

  // Per-stop location requirement is CONDITIONAL on the stop's canonical
  // type + method (migration 046), matching the rules the right-inspector
  // already enforces:
  //   experience_type='experience' (honor / Event-Activity) → no location
  //     required (these stops are location-less by design — e.g. a
  //     reading-program book). Must NOT block publish for "missing"
  //     location; that's the whole point of the type.
  //   experience_type='location' + 'gps'        → coordinates required.
  //   experience_type='location' + 'qr'         → address required.
  //   experience_type='location' + 'witnessed' / 'documented' → optional.
  //
  // Falls back to verification_tier for any pre-046 row whose canonical
  // pair never got backfilled (mirrors deriveExpType/deriveMethod in
  // RightInspector so the panel and this validator agree on the model).
  const gpsMissingCoords = stops.filter((s) => stopLocationIssue(s) === 'coords').length
  const qrMissingAddress  = stops.filter((s) => stopLocationIssue(s) === 'address').length
  if (gpsMissingCoords > 0)
    validationIssues.push(
      `${gpsMissingCoords} GPS stop(s) need coordinates. Open the stop and use the map picker.`,
    )
  if (qrMissingAddress > 0)
    validationIssues.push(
      `${qrMissingAddress} QR stop(s) need an address.`,
    )

  if (!passport.expected_spend_tier)
    validationIssues.push('Set an expected spend tier (Settings → Expected Spend).')
  // BLD-10 publish gate: personal passports require active Studio on the
  // actor. Institutional passports are handled by can_design (RLS) and
  // by the migration-045 trigger; no client check needed here. The
  // trigger is the real enforcement — this is a pre-flight so the user
  // sees the requirement before reaching Confirm.
  if (passport.proprietor_id === null && actorStudio === false) {
    validationIssues.push(
      'Publishing a personal passport to the marketplace requires Studio. Ask an admin for a Studio comp at /access/comp-subscriptions.',
    )
  }

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
      <div className="relative z-10 w-full max-w-md rounded-modal border border-hairline bg-white shadow-2xl">
        <div className="border-b border-hairline px-5 py-4">
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
                ? 'bg-green text-white'
                : i === idx
                ? 'bg-navy text-white'
                : 'bg-hairline text-muted'
            }`}
          >
            {i < idx ? '✓' : i + 1}
          </div>
          <span
            className={`text-xs ${
              i === idx ? 'font-semibold text-navy' : 'text-muted'
            }`}
          >
            {label}
          </span>
          {i < labels.length - 1 && <span className="text-hairline">›</span>}
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
        <h2 className="text-base font-semibold text-navy">Before you publish</h2>
        <p className="mt-1 text-sm text-muted">
          {issues.length === 0 ? 'Everything looks good!' : `${issues.length} issue(s) to resolve.`}
        </p>
      </div>

      {issues.length > 0 ? (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={issue} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-accent">✗</span>
              <span className="text-navy">{issue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-1.5 rounded-panel bg-cream px-4 py-3 text-sm">
          <div className="flex justify-between text-green">
            <span>Pages</span>
            <span className="font-semibold">{pageCount}</span>
          </div>
          <div className="flex justify-between text-green">
            <span>Stops</span>
            <span className="font-semibold">{stopCount}</span>
          </div>
          <div className="flex justify-between text-green">
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
        <h2 className="text-base font-semibold text-navy">Spend confirmation</h2>
        <p className="mt-1 text-sm text-muted">
          You've set the expected spend as{' '}
          <strong>{spendTierLabel(passport.expected_spend_tier)}</strong>.
        </p>
      </div>

      <div className="rounded-panel border border-hairline px-4 py-3 text-sm text-navy">
        <p>
          By publishing, you confirm that a typical visitor completing all stops will spend
          approximately <strong>{spendTierLabel(passport.expected_spend_tier)}</strong>.
        </p>
        {passport.expected_spend_note && (
          <p className="mt-2 text-xs text-muted">{passport.expected_spend_note}</p>
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
        <h2 className="text-base font-semibold text-navy">Pricing</h2>
        <p className="mt-1 text-sm text-muted">
          Set a price collectors will pay to download this passport.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-navy">$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={dollars}
            onChange={(e) =>
              onChange(Math.round(parseFloat(e.target.value || '0') * 100))
            }
            className="flex-1 rounded-panel border border-hairline px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green"
          />
        </div>
        <p className="text-xs text-muted">Set to $0 for a free passport.</p>
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
        <h2 className="text-base font-semibold text-navy">Ready to publish?</h2>
        <p className="mt-1 text-sm text-muted">
          Review the summary below, then click Publish.
        </p>
      </div>

      <div className="rounded-panel border border-hairline divide-y divide-hairline text-sm">
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
            <span className="text-muted">{label}</span>
            <span className="font-medium text-navy">{value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-panel bg-accent/10 px-3 py-2 text-xs text-accent">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={publishing}>
          ← Back
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-green hover:bg-green"
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
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-4xl">
        🎉
      </div>
      <div>
        <h2 className="text-base font-semibold text-navy">Published!</h2>
        <p className="mt-1 text-sm text-muted">
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
