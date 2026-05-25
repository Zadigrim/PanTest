'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CompletionToken,
  PrizeConfiguration,
  Stop,
  EmployeeAuthorization,
} from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalScreen = 'loading' | 'denied' | 'scan' | 'verify' | 'distribute' | 'success'

interface ExperienceStop {
  stopId: string
  stopName: string
  verificationMethod: string | null
}

interface ValidateSuccessPayload {
  token: CompletionToken
  prizeConfig: PrizeConfiguration | null
  collectorFirstName: string | null
  experienceStops: ExperienceStop[]
}

interface CurrentEmployee {
  displayName: string | null
  can_verify: boolean
  can_distribute_prizes: boolean
  can_add_extras: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verificationPrompt(method: string | null): string {
  switch (method) {
    case 'witnessed':
      return 'Confirm you witnessed the collector complete this activity.'
    case 'documented':
      return 'Confirm you have reviewed their documentation or proof.'
    case 'presence':
      return 'Confirm the collector was physically present at this stop.'
    case 'honor':
      return 'Collector self-reported — acknowledge on their behalf.'
    default:
      return 'Confirm this experience stop was completed.'
  }
}

// ---------------------------------------------------------------------------
// Lazy QR scanner — wraps html5-qrcode dynamically
// We manage it imperatively with a ref so it only lives in the scan screen.
// ---------------------------------------------------------------------------

function QrScannerWidget({
  onResult,
  onError,
  onCancel,
}: {
  onResult: (code: string) => void
  onError: (msg: string) => void
  onCancel: () => void
}) {
  const mountId = 'terminal-qr-reader'
  const scannerRef = useRef<{ stop: () => Promise<unknown> } | null>(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!active) return

        const scanner = new Html5Qrcode(mountId)
        scannerRef.current = scanner as unknown as { stop: () => Promise<unknown> }

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            if (!active) return
            scanner.stop().catch(() => {})
            onResult(decoded)
          },
          () => {/* scan failures are normal */ },
        )
      } catch {
        if (active) onError('Camera unavailable. Enter code manually.')
      }
    }

    start()

    return () => {
      active = false
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [onResult, onError])

  return (
    <div>
      <div id={mountId} className="rounded-panel overflow-hidden" />
      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-3 py-3 rounded-panel bg-white/10 text-cream text-base font-medium hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
      >
        Cancel scanner
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen 1: Scan / Token entry
// ---------------------------------------------------------------------------

function ScanScreen({
  employeeName,
  onLookup,
}: {
  employeeName: string | null
  onLookup: (code: string) => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!showQr) inputRef.current?.focus()
  }, [showQr])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError(null)
    setLoading(true)
    try {
      await onLookup(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token lookup failed')
      setLoading(false)
    }
  }

  function handleQrResult(scannedCode: string) {
    setShowQr(false)
    const trimmed = scannedCode.trim().toUpperCase()
    setCode(trimmed)
    setError(null)
    setLoading(true)
    onLookup(trimmed).catch((err) => {
      setError(err instanceof Error ? err.message : 'Token lookup failed')
      setLoading(false)
    })
  }

  function handleQrError(msg: string) {
    setShowQr(false)
    setError(msg)
  }

  return (
    <div className="flex flex-col min-h-screen bg-navy text-white px-6 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">OkujiConnect Terminal</h1>
        {employeeName && (
          <p className="mt-1 text-cream/70 text-base">
            Signed in as{' '}
            <span className="text-white font-semibold">{employeeName}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 max-w-md w-full mx-auto">
        {/* Token entry form */}
        {!showQr && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="token-input"
                className="text-lg font-medium text-cream"
              >
                Enter token code
              </label>
              <input
                id="token-input"
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setError(null)
                }}
                placeholder="MCM-XXXX-XX"
                aria-describedby={error ? 'scan-error' : undefined}
                className="h-16 rounded-panel border-2 border-white/20 bg-white/10 px-5 text-2xl font-mono font-bold text-white placeholder:text-white/30 focus:outline-none focus:border-green focus:bg-white/15 transition-colors tracking-widest uppercase"
              />
            </div>

            {/* Error in large red text */}
            {error && (
              <p
                id="scan-error"
                role="alert"
                className="text-xl font-semibold text-accent"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="h-16 rounded-panel bg-green text-white text-xl font-bold disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green"
            >
              {loading ? 'Looking up…' : 'Look up'}
            </button>
          </form>
        )}

        {/* QR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-cream/50 text-sm whitespace-nowrap">
            or scan QR code
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* QR scanner toggle */}
        {!showQr ? (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setShowQr(true)
            }}
            className="h-14 rounded-panel border-2 border-white/20 text-cream text-base font-medium hover:border-green hover:text-white active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green"
          >
            Open camera scanner
          </button>
        ) : (
          <div className="rounded-panel overflow-hidden border-2 border-green">
            <QrScannerWidget
              onResult={handleQrResult}
              onError={handleQrError}
              onCancel={() => setShowQr(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen 2: Verify experience stops (conditional)
// ---------------------------------------------------------------------------

function VerifyScreen({
  payload,
  onVerify,
  onBack,
}: {
  payload: ValidateSuccessPayload
  onVerify: () => void
  onBack: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const stops = payload.experienceStops
  const allChecked = stops.length === 0 || stops.every((s) => checked.has(s.stopId))

  return (
    <div className="flex flex-col min-h-screen bg-navy text-white px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Experience verification</h1>
        <p className="mt-1 text-cream/70">
          Collector:{' '}
          <span className="text-white font-semibold">
            {payload.collectorFirstName ?? 'Collector'}
          </span>
        </p>
        <p className="text-cream/50 text-sm mt-0.5 font-mono">
          {payload.token.token_code}
        </p>
      </div>

      <div className="max-w-lg w-full mx-auto space-y-4 flex-1">
        {stops.map((stop) => {
          const isChecked = checked.has(stop.stopId)
          return (
            <label
              key={stop.stopId}
              className={`flex items-start gap-4 p-4 rounded-panel border-2 cursor-pointer transition-colors ${
                isChecked
                  ? 'border-green bg-green/10'
                  : 'border-white/20 bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  setChecked((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(stop.stopId)
                    else next.delete(stop.stopId)
                    return next
                  })
                }}
                className="mt-1 w-6 h-6 accent-green shrink-0"
                aria-label={`Verify stop: ${stop.stopName}`}
              />
              <div>
                <p className="font-semibold text-lg text-white leading-tight">
                  {stop.stopName}
                </p>
                <p className="text-cream/70 text-sm mt-1">
                  {verificationPrompt(stop.verificationMethod)}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="max-w-lg w-full mx-auto flex flex-col gap-3 mt-8">
        <button
          type="button"
          onClick={onVerify}
          disabled={!allChecked}
          className="h-16 rounded-panel bg-green text-white text-xl font-bold disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green"
        >
          ✓ Verify &amp; continue
        </button>
        <button
          type="button"
          onClick={onBack}
          className="h-12 rounded-panel border-2 border-white/20 text-cream text-base font-medium hover:border-white/40 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen 3: Distribute — REQUIRED, cannot be dismissed
// ---------------------------------------------------------------------------

function DistributeScreen({
  payload,
  canAddExtras,
  onComplete,
}: {
  payload: ValidateSuccessPayload
  canAddExtras: boolean
  onComplete: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraEnabled, setExtraEnabled] = useState(false)
  const [extraAmount, setExtraAmount] = useState('')
  const [extraNote, setExtraNote] = useState('')
  const [extraNoteError, setExtraNoteError] = useState<string | null>(null)

  async function redeem(action: 'distributed' | 'pending') {
    if (extraEnabled && !extraNote.trim()) {
      setExtraNoteError('A note is required when adding an extra gift card.')
      return
    }
    if (extraEnabled && extraAmount && isNaN(parseFloat(extraAmount))) {
      setExtraNoteError('Extra amount must be a valid number.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        tokenCode: payload.token.token_code,
        action,
      }
      if (extraEnabled && extraNote.trim()) {
        body.note = extraNote.trim()
        if (extraAmount) {
          body.extraGiftCardCents = Math.round(parseFloat(extraAmount) * 100)
        }
      }

      const res = await fetch('/api/token/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Redemption failed')
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redemption failed — try again')
      setLoading(false)
    }
  }

  const prizeDescription =
    payload.prizeConfig?.prize_description ??
    'No prize configured — check with manager.'
  const prizeValue =
    payload.prizeConfig?.prize_value_cents != null
      ? `$${(payload.prizeConfig.prize_value_cents / 100).toFixed(2)}`
      : null

  return (
    <div className="flex flex-col min-h-screen bg-navy text-white px-6 py-8">
      {/* Warning header */}
      <div className="mb-6 bg-accent/20 border-2 border-accent rounded-panel px-5 py-4">
        <p className="text-2xl font-bold text-accent leading-tight">
          ⚠ REQUIRED — Prize distribution
        </p>
        <p className="text-cream/80 text-sm mt-1">
          Both buttons create an accountable record. No dismiss option.
        </p>
      </div>

      {/* Token + collector */}
      <div className="mb-5 bg-white/5 rounded-panel px-5 py-4 space-y-1">
        <p className="text-cream/50 text-xs uppercase tracking-wide font-medium">
          Token
        </p>
        <p className="font-mono text-xl font-bold text-white tracking-widest">
          {payload.token.token_code}
        </p>
        <p className="text-cream/70 text-sm pt-1">
          Collector:{' '}
          <span className="text-white font-semibold">
            {payload.collectorFirstName ?? 'Unknown'}
          </span>
        </p>
        <p className="text-cream/60 text-sm">Page completion confirmed ✓</p>
      </div>

      {/* Prize — READ ONLY */}
      <div className="mb-6 bg-green/10 border-2 border-green rounded-panel px-5 py-4">
        <p className="text-xs text-cream/50 uppercase tracking-wide font-medium mb-1">
          Prize to distribute
        </p>
        <p className="text-white text-lg font-semibold leading-snug">
          {prizeDescription}
        </p>
        {prizeValue && (
          <p className="text-green text-sm mt-1 font-medium">
            Value: {prizeValue}
          </p>
        )}
        <p className="text-cream/30 text-xs mt-2 italic">
          Set by management — read only
        </p>
      </div>

      {/* Extra gift card (only if can_add_extras) */}
      {canAddExtras && (
        <div className="mb-6 bg-white/5 rounded-panel px-5 py-4">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={extraEnabled}
              onChange={(e) => {
                setExtraEnabled(e.target.checked)
                setExtraNoteError(null)
              }}
              className="w-5 h-5 accent-accent"
            />
            <span className="text-base font-medium text-white">
              Add extra gift card
            </span>
          </label>

          {extraEnabled && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-cream/70">
                  Amount (USD, optional)
                </label>
                <div className="relative w-44">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none select-none">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-12 w-full rounded-panel border border-white/20 bg-white/10 pl-7 pr-3 text-lg font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-cream/70">
                  Note{' '}
                  <span className="text-accent" aria-hidden="true">*</span>{' '}
                  <span className="text-white/40">(required)</span>
                </label>
                <textarea
                  value={extraNote}
                  onChange={(e) => {
                    setExtraNote(e.target.value)
                    setExtraNoteError(null)
                  }}
                  placeholder="Reason for extra gift card…"
                  rows={2}
                  className="rounded-panel border border-white/20 bg-white/10 px-3 py-2 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent transition-colors resize-none"
                />
                {extraNoteError && (
                  <p role="alert" className="text-accent text-sm">
                    {extraNoteError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global error */}
      {error && (
        <p role="alert" className="mb-4 text-xl font-semibold text-accent">
          {error}
        </p>
      )}

      {/* Action buttons — both create records, NO dismiss */}
      <div className="mt-auto flex flex-col gap-4">
        {/* Primary: prize given now */}
        <button
          type="button"
          onClick={() => redeem('distributed')}
          disabled={loading}
          className="min-h-[80px] rounded-panel bg-green text-white text-xl font-bold disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green px-4 py-4 leading-tight"
        >
          {loading ? (
            'Logging…'
          ) : (
            <>
              ✓ Prize given · log it
              <span className="block text-sm font-normal text-cream/80 mt-0.5">
                Marks prize as distributed now
              </span>
            </>
          )}
        </button>

        {/* Secondary: manager will distribute later */}
        <button
          type="button"
          onClick={() => redeem('pending')}
          disabled={loading}
          className="min-h-[60px] rounded-panel bg-white/10 border-2 border-white/20 text-cream text-base font-medium disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 px-4 py-3 leading-tight"
        >
          Manager will distribute later
          <span className="block text-xs text-cream/50 mt-0.5">
            Sets distribution_pending — tracked in dashboard
          </span>
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------

function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy text-white px-6 py-8 text-center">
      <div className="text-7xl mb-6" aria-hidden="true">✓</div>
      <h1 className="text-3xl font-bold mb-2">All done!</h1>
      <p className="text-cream/70 text-lg mb-10">
        Redemption logged successfully.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="min-h-[64px] w-full max-w-xs rounded-panel bg-green text-white text-xl font-bold active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green px-6 py-4"
      >
        Scan next token
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Access denied screen
// ---------------------------------------------------------------------------

function AccessDeniedScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-navy text-white px-6 py-8 text-center">
      <div className="text-6xl mb-6" aria-hidden="true">🔒</div>
      <h1 className="text-2xl font-bold mb-2">Access denied</h1>
      <p className="text-cream/60 max-w-sm leading-relaxed">
        You need an active employee authorization with verification permission to use
        this terminal. Contact your manager to be granted access.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main terminal page
// ---------------------------------------------------------------------------

export default function TerminalPage() {
  const [screen, setScreen] = useState<TerminalScreen>('loading')
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null)
  const [validatePayload, setValidatePayload] = useState<ValidateSuccessPayload | null>(null)

  // Auth + authorization check on mount
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()

      if (authErr || !user) {
        window.location.href = '/login?next=/terminal'
        return
      }

      // Require can_verify = true for terminal use
      const { data: authz } = await supabase
        .from('employee_authorizations')
        .select(
          'institution_id, role_label, can_verify, can_distribute_prizes, can_add_extras',
        )
        .eq('user_id', user.id)
        .eq('can_verify', true)
        .limit(1)
        .single<
          Pick<
            EmployeeAuthorization,
            | 'institution_id'
            | 'role_label'
            | 'can_verify'
            | 'can_distribute_prizes'
            | 'can_add_extras'
          >
        >()

      if (!authz) {
        setScreen('denied')
        return
      }

      // Fetch profile display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      setEmployee({
        displayName: profile?.display_name ?? null,
        can_verify: authz.can_verify ?? false,
        can_distribute_prizes: authz.can_distribute_prizes ?? false,
        can_add_extras: authz.can_add_extras ?? false,
      })
      setScreen('scan')
    }

    checkAuth()
  }, [])

  // Token lookup: POST to /api/token/validate, then fetch experience stops
  const handleLookup = useCallback(async (tokenCode: string) => {
    const res = await fetch('/api/token/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenCode }),
    })

    const json = (await res.json()) as
      | {
          valid: true
          token: CompletionToken
          prizeConfig: PrizeConfiguration | null
          collectorFirstName: string | null
        }
      | { valid: false; reason: string }
      | { error: string }

    if (!res.ok) {
      const msg = 'error' in json ? json.error : 'Validation failed'
      throw new Error(msg)
    }

    if (!('valid' in json) || !json.valid) {
      throw new Error('reason' in json ? json.reason : 'Invalid token')
    }

    // Fetch experience stops that need employee sign-off for this page
    const supabase = createClient()
    const { data: stopRows } = await supabase
      .from('stops')
      .select('id, name, experience_type, experience_verification_method')
      .eq('page_id', json.token.page_id)
      .eq('experience_type', 'experience')
      .not('experience_verification_method', 'is', null) as {
        data: Pick<
          Stop,
          'id' | 'name' | 'experience_type' | 'experience_verification_method'
        >[] | null
      }

    const experienceStops: ExperienceStop[] = (stopRows ?? [])
      // 'honor' is self-reported and doesn't require employee sign-off
      .filter((s) => s.experience_verification_method !== 'honor')
      .map((s) => ({
        stopId: s.id,
        stopName: s.name,
        verificationMethod: s.experience_verification_method,
      }))

    const payload: ValidateSuccessPayload = {
      token: json.token,
      prizeConfig: json.prizeConfig,
      collectorFirstName: json.collectorFirstName,
      experienceStops,
    }

    setValidatePayload(payload)

    // If there are experience stops requiring sign-off, go to verify screen first
    if (experienceStops.length > 0) {
      setScreen('verify')
    } else {
      setScreen('distribute')
    }
  }, [])

  function handleReset() {
    setValidatePayload(null)
    setScreen('scan')
  }

  // ---------------------------------------------------------------------------
  // Render switch
  // ---------------------------------------------------------------------------

  if (screen === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <p className="text-cream/60 text-lg animate-pulse">
          Initializing terminal…
        </p>
      </div>
    )
  }

  if (screen === 'denied') return <AccessDeniedScreen />

  if (screen === 'success') return <SuccessScreen onReset={handleReset} />

  if (screen === 'scan') {
    return (
      <ScanScreen
        employeeName={employee?.displayName ?? null}
        onLookup={handleLookup}
      />
    )
  }

  if (screen === 'verify' && validatePayload) {
    return (
      <VerifyScreen
        payload={validatePayload}
        onVerify={() => setScreen('distribute')}
        onBack={() => setScreen('scan')}
      />
    )
  }

  if (screen === 'distribute' && validatePayload) {
    return (
      <DistributeScreen
        payload={validatePayload}
        canAddExtras={employee?.can_add_extras ?? false}
        onComplete={() => setScreen('success')}
      />
    )
  }

  // Fallback — should never reach here
  return <ScanScreen employeeName={null} onLookup={handleLookup} />
}
