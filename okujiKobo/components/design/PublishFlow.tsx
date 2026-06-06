'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePassportStore } from '@/lib/design/passport-store'
import { Button } from './ui/Button'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import { isStudio, type SubscriptionFields } from '@/lib/roles'
import { runPublishChecklist } from '@/lib/design/publish-checklist'

interface Props {
  onClose: () => void
}

type Step = 'validate' | 'spend' | 'pricing' | 'art-lock' | 'correction' | 'confirm' | 'blocked' | 'published'

export function PublishFlow({ onClose }: Props) {
  const passport = usePassportStore((s) => s.passport)
  const pages = usePassportStore((s) => s.pages)
  const stops = usePassportStore((s) => s.stops)
  const updatePassport = usePassportStore((s) => s.updatePassport)

  const [step, setStep] = useState<Step>('validate')
  const [priceCents, setPriceCents] = useState(passport?.price_cents ?? 0)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Correction-step state — only populated when we route into
  // the with-holders republish path. holderCount is also used
  // by the Confirm step copy when > 0.
  const [holderCount, setHolderCount] = useState<number>(0)
  const [justification, setJustification] = useState<string>('')
  const [whatChanged, setWhatChanged] = useState<string>('')
  const [blockedSummary, setBlockedSummary] = useState<{
    counts: Record<string, number>
  } | null>(null)
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false)
  const [adminOverride, setAdminOverride] = useState(false)

  // Pre-flight: holder count + viewer admin flag. The holder
  // count decides whether to route into the correction step;
  // viewer admin enables the override path when blocked.
  useEffect(() => {
    if (!passport) return
    const supabase = createClient()
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ count: acq }, { count: cp }, { data: prof }] = await Promise.all([
        db.from('acquisitions')
          .select('id', { count: 'exact', head: true })
          .eq('passport_id', passport.id),
        db.from('collector_passports')
          .select('id', { count: 'exact', head: true })
          .eq('passport_id', passport.id),
        db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
      ])
      setHolderCount(Math.max(acq ?? 0, cp ?? 0))
      setViewerIsAdmin(!!prof?.is_platform_admin)
    })()
  }, [passport])
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

  // Validation runs against the shared checklist — the dashboard
  // calls the same function to flag near-publish drafts, so the
  // editor and the dashboard cannot disagree about what blocks a
  // publish.
  const { blockers: validationIssues } = runPublishChecklist({
    passport,
    pageCount: pages.length,
    stops,
    actorIsStudio: actorStudio,
  })

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)

    // Correction-only routing: when there are holders, ALL
    // publishes go through /api/passports/:id/republish so the
    // server diffs the snapshot, requires the justification,
    // and writes the audit log. The price update is folded in
    // (the route's UPDATE doesn't write price_cents — we do
    // it pre-call here so the same correction path supports
    // a price tweak).
    if (holderCount > 0) {
      // Persist the price first (the republish route doesn't
      // touch it). RLS allows the creator's UPDATE in any
      // state.
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('passports')
        .update({ price_cents: priceCents })
        .eq('id', passport.id)

      const res = await fetch(`/api/passports/${passport.id}/republish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justification, whatChanged,
          adminOverride: adminOverride && viewerIsAdmin,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        if (res.status === 422 && j.summary) {
          setBlockedSummary(j.summary)
          setStep('blocked')
        } else {
          setError(j.error ?? `Republish failed (${res.status})`)
        }
        setPublishing(false)
        return
      }
    } else {
      // Zero-holder path — direct UPDATE (unchanged from the
      // shipped publish behavior). Writes price_cents too.
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
      if (err) {
        setPublishing(false)
        setError(err.message)
        return
      }
    }
    updatePassport({ status: 'published', is_published: true, price_cents: priceCents })

    // Page-image regen runs the same way in both branches —
    // republish overwrites at the same storage paths
    // (publish-images.tsx is idempotent). Failures don't
    // block the user; Explore falls back to live-render.
    try {
      const { generateAndUploadPassportImages } = await import('@/lib/explore/publish-images')
      await generateAndUploadPassportImages(passport, pages, stops)
    } catch (imgErr) {
      console.warn('[publish] page-image generation failed:', imgErr)
    }

    setPublishing(false)
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
              onContinue={() => setStep(holderCount > 0 ? 'correction' : 'art-lock')}
              onBack={() => setStep('spend')}
            />
          )}
          {step === 'art-lock' && (
            <ArtLockStep
              onContinue={() => setStep('confirm')}
              onBack={() => setStep('pricing')}
            />
          )}
          {step === 'correction' && (
            <CorrectionStep
              holderCount={holderCount}
              justification={justification}
              whatChanged={whatChanged}
              onJustification={setJustification}
              onWhatChanged={setWhatChanged}
              onContinue={() => setStep('confirm')}
              onBack={() => setStep('pricing')}
            />
          )}
          {step === 'confirm' && (
            <ConfirmStep
              passport={passport}
              priceCents={priceCents}
              stopCount={stops.length}
              publishing={publishing}
              error={error}
              holderCount={holderCount}
              onPublish={handlePublish}
              onBack={() => setStep(holderCount > 0 ? 'correction' : 'art-lock')}
            />
          )}
          {step === 'blocked' && blockedSummary && (
            <BlockedStep
              summary={blockedSummary}
              holderCount={holderCount}
              viewerIsAdmin={viewerIsAdmin}
              adminOverride={adminOverride}
              onToggleOverride={setAdminOverride}
              onRetry={() => { setStep('confirm'); setBlockedSummary(null) }}
              onClose={onClose}
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
  holderCount,
  onPublish,
  onBack,
}: {
  passport: NonNullable<ReturnType<typeof usePassportStore.getState>['passport']>
  priceCents: number
  stopCount: number
  publishing: boolean
  error: string | null
  holderCount: number
  onPublish: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-navy">
          {holderCount > 0 ? 'Ready to republish?' : 'Ready to publish?'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {holderCount > 0
            ? `This correction will reach ${holderCount} holder${holderCount === 1 ? '' : 's'} immediately.`
            : 'Review the summary below, then click Publish.'}
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

// ── Art-lock step ───────────────────────────────────────────
// Inserted on EVERY zero-holder publish (first publish AND
// republish-from-draft when no one has acquired yet). The
// lock activates the moment a holder acquires — which can
// happen seconds after publish — so the warning is honest
// even on a freshly-unpublished draft.
//
// Lists are organised by what the diff engine
// (lib/design/republish/diff.ts) classifies as `other`
// (PERMANENT — blocks the correction republish) versus the
// three critical categories + factual_text (CORRECTABLE via
// unpublish → fix → republish-with-justification). Keeping
// the two lists side-by-side prevents the false impression
// that "publish locks everything".
//
// The Continue button on this step does NOT publish — it
// advances to the existing ConfirmStep which has the summary
// table and the actual Publish button. Two reads + two
// clicks > one. Belt and suspenders for an irreversible
// art commitment.

function ArtLockStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [ack, setAck] = useState(false)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-navy">Heads up — art locks at first acquisition</h2>
        <p className="mt-1 text-sm text-muted">
          Once <strong>any</strong> holder acquires this passport, the artistic and structural
          choices below become permanent. You can still unpublish at any time to delist from
          Explore — but the items in the left column can&rsquo;t be changed when you republish to
          existing holders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-panel border-[1.5px] border-red/40 bg-red/5 p-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[1.5px] text-red">
            Permanent at first acquisition
          </p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-ink list-disc pl-4">
            <li>Cover art (front, inside, back)</li>
            <li>Page layout &amp; ordering</li>
            <li>All page-element art (stickers, decoration, illustrations)</li>
            <li>Theme — paper, pattern, background colors</li>
            <li>Adding or removing pages</li>
            <li>Adding new stops</li>
            <li>Moving a stop between pages</li>
            <li>Price &amp; expected-spend tier</li>
          </ul>
        </div>

        <div className="rounded-panel border-[1.5px] border-green/40 bg-green/5 p-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[1.5px] text-green">
            Correctable via unpublish + republish
          </p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-ink list-disc pl-4">
            <li>Stop coordinates (lat / lng)</li>
            <li>Stop street address, city, state, ZIP, country</li>
            <li>Verification method (GPS, QR, self-report) &amp; radius</li>
            <li>QR code token regeneration</li>
            <li>Marking a stop permanently closed</li>
            <li>Stop name, learning objective, journal prompt <span className="text-muted">(flagged)</span></li>
            <li>Passport title &amp; description <span className="text-muted">(flagged)</span></li>
          </ul>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        <strong>Flagged</strong> items publish, but admins are notified — keep text edits
        genuinely factual. Cosmetic word-polish gets rejected.
      </p>

      <label className="flex items-start gap-2 rounded-panel border border-hairline bg-surface-workspace px-3 py-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-navy"
        />
        <span>
          I&rsquo;ve inspected the cover, pages, and all art. I understand they&rsquo;ll lock the
          moment a holder acquires this passport.
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button size="sm" className="flex-1" onClick={onContinue} disabled={!ack}>
          Continue to confirm
        </Button>
      </div>
    </div>
  )
}

// ── Correction step ─────────────────────────────────────────
// Only rendered when holderCount > 0 (republish to existing
// holders). Collects the designer's required justification +
// the holder-facing what-changed line. The server diff gate
// is the actual enforcement — this UI is a forced pause that
// gets the words on the record BEFORE the publish call.

function CorrectionStep({
  holderCount,
  justification,
  whatChanged,
  onJustification,
  onWhatChanged,
  onContinue,
  onBack,
}: {
  holderCount: number
  justification: string
  whatChanged: string
  onJustification: (v: string) => void
  onWhatChanged: (v: string) => void
  onContinue: () => void
  onBack: () => void
}) {
  const jOk = justification.trim().length >= 10 && justification.trim().length <= 1000
  const wOk = whatChanged.trim().length >= 3   && whatChanged.trim().length <= 200
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-navy">Correction</h2>
        <p className="mt-1 text-sm text-muted">
          Republishing to <strong>{holderCount}</strong> holder{holderCount === 1 ? '' : 's'} is
          for critical fixes only — coordinates, addresses, verification, stop closures, or
          factual-text corrections. Cosmetic edits will be blocked.
        </p>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block font-semibold uppercase tracking-[1.5px] text-muted">
          Why are you republishing? <span className="text-red">*</span>
        </span>
        <textarea
          value={justification}
          onChange={(e) => onJustification(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Lime Kiln stop coordinates were 400 m off — corrected to the trailhead sign."
          className="w-full resize-none rounded-panel border border-hairline bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
        <span className="mt-1 block tabular-nums text-muted">
          {justification.trim().length} / 1000 — specific. Admins read these.
        </span>
      </label>

      <label className="block text-xs">
        <span className="mb-1 block font-semibold uppercase tracking-[1.5px] text-muted">
          What will holders see in the notice? <span className="text-red">*</span>
        </span>
        <input
          type="text"
          value={whatChanged}
          onChange={(e) => onWhatChanged(e.target.value)}
          maxLength={200}
          placeholder="Coordinates corrected for Lime Kiln."
          className="w-full rounded-panel border border-hairline bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
        <span className="mt-1 block tabular-nums text-muted">
          {whatChanged.trim().length} / 200 — one short, plain sentence.
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={onContinue}
          disabled={!jOk || !wOk}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

// ── Blocked step ────────────────────────────────────────────
// Surfaces the server's 422 verdict when the diff includes
// non-critical (`other`) changes. Lists the per-category
// counts so the designer can see WHY it was blocked. Platform
// admins get an override checkbox; everyone else must revert
// the offending edits and retry.

function BlockedStep({
  summary,
  holderCount,
  viewerIsAdmin,
  adminOverride,
  onToggleOverride,
  onRetry,
  onClose,
}: {
  summary: { counts: Record<string, number> }
  holderCount: number
  viewerIsAdmin: boolean
  adminOverride: boolean
  onToggleOverride: (v: boolean) => void
  onRetry: () => void
  onClose: () => void
}) {
  const c = summary.counts
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-red">Republish blocked</h2>
        <p className="mt-1 text-sm text-muted">
          These edits aren&rsquo;t corrections. Republishing to <strong>{holderCount}</strong>{' '}
          holder{holderCount === 1 ? '' : 's'} is for critical fixes only.
        </p>
      </div>

      <div className="rounded-panel border border-hairline divide-y divide-hairline text-sm">
        <CountRow label="Location data" n={c.location_data ?? 0}                 verdict="ok" />
        <CountRow label="Verification mechanics" n={c.verification_mechanics ?? 0} verdict="ok" />
        <CountRow label="Stop closure / removal" n={c.stop_closure ?? 0}          verdict="ok" />
        <CountRow label="Factual text" n={c.factual_text ?? 0}                    verdict="flag" />
        <CountRow label="Other (cosmetic / non-correction)" n={c.other ?? 0}      verdict="block" />
      </div>

      <p className="text-xs text-muted">
        Revert the <strong>Other</strong> edits in the designer and retry, or contact support.
      </p>

      {viewerIsAdmin && (
        <label className="flex items-start gap-2 rounded-panel border border-accent bg-accent/10 px-3 py-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={adminOverride}
            onChange={(e) => onToggleOverride(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-accent"
          />
          <span>
            <strong>Admin override</strong> — publish anyway. Logged with your id as
            <code className="ml-1">admin_override_by</code>.
          </span>
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button size="sm" className="flex-1" onClick={onRetry}>
          {viewerIsAdmin && adminOverride ? 'Override + republish' : 'Back to Confirm'}
        </Button>
      </div>
    </div>
  )
}
function CountRow({ label, n, verdict }: { label: string; n: number; verdict: 'ok' | 'flag' | 'block' }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums font-semibold ${
        n === 0 ? 'text-hairline'
        : verdict === 'block' ? 'text-red'
        : verdict === 'flag'  ? 'text-accent'
        : 'text-green'
      }`}>
        {n}
      </span>
    </div>
  )
}
