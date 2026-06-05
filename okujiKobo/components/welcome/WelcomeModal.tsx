'use client'

import { Fragment, useEffect, useRef } from 'react'
import { WELCOME_COPY, interpolate, type AudienceKey } from '@/lib/welcome/copy'

/**
 * The welcome modal itself — pure presentation.
 *
 * Layout (~600px wide, no internal scroll, no pagination):
 *   1. Header — kicker, lockup, identity line
 *   2. The Loop — four stamp-node steps on a dashed trail
 *   3. Audience band — adapts per `audience` (admin omits this slot)
 *   4. CTA row — primary + optional secondary + quiet skip
 *
 * Tokens-only chrome:
 *   scrim       = bg-navy/60
 *   modal bg    = bg-cream
 *   border      = border-ink (2px)
 *   radius      = 16  (per spec — slightly larger than the rounded-modal
 *                       token's 12px; uses inline style rather than
 *                       inventing a new token)
 *   loop panel  = bg-surface-workspace + faint border
 *   stamp node  = 1.6px ink ring + inset 1px hairline ring, cream fill
 *
 * Behavior is owned by the parent `WelcomeMount` — this component just
 * fires `onDismiss` on Esc / × / Skip and `onCtaNavigate` when the user
 * clicks a CTA link (the parent persists dismissal before navigation).
 */
export function WelcomeModal({
  audience,
  institutionName,
  onDismiss,
}: {
  audience: AudienceKey
  institutionName: string | null
  onDismiss: () => void
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Esc to dismiss; focus the close button on mount so SR users land
  // somewhere predictable.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const audienceBand = audience === 'admin'
    ? null
    : WELCOME_COPY.audience[audience]
  const cta = WELCOME_COPY.cta[audience]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Scrim — derived from the navy token, not a novel literal */}
      <button
        type="button"
        aria-label="Dismiss welcome"
        onClick={onDismiss}
        className="absolute inset-0 bg-navy/60"
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-[600px] border-[2px] border-ink bg-cream shadow-2xl"
        style={{ borderRadius: 16, padding: 32 }}
      >
        {/* × close, top-right */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onDismiss}
          aria-label={WELCOME_COPY.closeLabel}
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-hairline bg-cream text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* ── Header ───────────────────────────────────── */}
        <header className="text-center">
          <p
            className="text-[10.5px] font-medium text-accent"
            style={{ letterSpacing: 4 }}
          >
            {WELCOME_COPY.kicker}
          </p>
          <div
            className="mt-2 inline-flex items-center gap-2"
            id="welcome-title"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border-[1.5px] border-ink bg-cream text-[14px] font-semibold text-ink"
              style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
            >
              o.
            </span>
            <span
              className="text-[23px] font-medium"
              style={{
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
              }}
            >
              <span className="text-ink">{WELCOME_COPY.wordmarkLeading}</span>
              <span className="text-muted">{WELCOME_COPY.wordmarkTrailing}</span>
            </span>
          </div>
          <p className="mx-auto mt-3 max-w-[480px] text-[15.5px] leading-snug text-ink">
            {WELCOME_COPY.identityLine}
          </p>
        </header>

        {/* ── The Loop ─────────────────────────────────── */}
        <section
          aria-label={WELCOME_COPY.loop.sectionLabel}
          className="relative mt-7 rounded-[12px] border-[1.5px] border-surface-faintdiv bg-surface-workspace px-4 py-6"
        >
          <LoopRow />
        </section>

        {/* ── Audience band ────────────────────────────── */}
        {audienceBand && (
          <section className="mt-6 flex items-center gap-3 rounded-[12px] border border-surface-faintdiv bg-surface-rail px-4 py-3">
            <AudienceGlyph audience={audience} />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-ink">
                {interpolate(audienceBand.title, institutionName)}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                {interpolate(audienceBand.sub, institutionName)}
              </p>
            </div>
          </section>
        )}

        {/* ── CTA row ──────────────────────────────────── */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a
              href={cta.primaryHref}
              onClick={onDismiss}
              className="inline-flex h-10 items-center rounded-[8px] border-[1.5px] border-ink bg-green px-4 text-[13.5px] font-semibold text-white hover:bg-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
            >
              {cta.primaryLabel}
            </a>
            {cta.secondaryLabel && cta.secondaryHref && (
              <a
                href={cta.secondaryHref}
                onClick={onDismiss}
                className="inline-flex h-10 items-center rounded-[8px] border-[1.5px] border-ink bg-cream px-4 text-[13.5px] font-semibold text-ink hover:border-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
              >
                {cta.secondaryLabel}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
          >
            {WELCOME_COPY.skipLink}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// The Loop row — four stamp nodes on a dashed route line.
// ───────────────────────────────────────────────────────────

function LoopRow() {
  const steps = WELCOME_COPY.loop.steps
  return (
    <div className="relative">
      {/* Dashed route line behind the nodes. Positioned to pass
          through the vertical center of the 60px stamp nodes
          (node centerline ≈ 30px from top of node block). */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 h-px border-t border-dashed border-hairline"
        style={{ top: 30 }}
      />
      <ol className="relative grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-0">
        {steps.map((step, i) => (
          <Fragment key={step.key}>
            <li className="flex flex-col items-center text-center">
              {/* Stamp node — cream fill so it visually punches
                  through the dashed line behind it. */}
              <span
                aria-hidden="true"
                className="relative inline-flex h-[60px] w-[60px] items-center justify-center rounded-full bg-cream"
                style={{
                  border: '1.6px solid #1f1d1a',
                  boxShadow: 'inset 0 0 0 1px #c8bfa9',
                }}
              >
                {/* The file at /stamp-icons/loop-*.svg is the
                    source of truth — swap the file, modal updates. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.iconPath}
                  alt=""
                  width={30}
                  height={30}
                  className="text-ink"
                />
              </span>
              <p className="mt-2 text-[14px] font-bold text-ink">{step.word}</p>
              <p className="mt-0.5 max-w-[120px] text-[11.5px] leading-snug text-muted">
                {step.line}
              </p>
            </li>
            {i < steps.length - 1 && (
              <li aria-hidden="true" className="self-start pt-[22px] text-accent">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

// ───────────────────────────────────────────────────────────
// Audience-band line glyphs.
// ───────────────────────────────────────────────────────────

function AudienceGlyph({ audience }: { audience: AudienceKey }) {
  const isInstitutional =
    audience === 'institutional_designer' || audience === 'institutional_member'
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center text-ink"
    >
      {isInstitutional ? <BuildingGlyph /> : <PersonGlyph />}
    </span>
  )
}

function BuildingGlyph() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21V8" /><path d="M15 21V8" />
      <path d="M8 7h8" /><path d="M9 12h6" /><path d="M9 16h6" />
    </svg>
  )
}
function PersonGlyph() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}
