'use client'

import { useState, useRef, useCallback } from 'react'

type Screen = 'scan' | 'verify' | 'distribute'

interface ValidatedToken {
  tokenId: string
  passportTitle: string
  pageTitle: string
  collectorName: string
  prizeDescription: string | null
  prizeValueCents: number | null
  canAddExtras: boolean
  requiresVerification: boolean
  verificationPrompt: string | null
}

export default function TerminalPage() {
  const [screen, setScreen] = useState<Screen>('scan')
  const [tokenInput, setTokenInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validatedToken, setValidatedToken] = useState<ValidatedToken | null>(null)
  const [extraNote, setExtraNote] = useState('')
  const [extraValue, setExtraValue] = useState('')
  const [done, setDone] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')
  const [showQR, setShowQR] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<unknown>(null)

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/token/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenCode: code.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Token not valid')
        setLoading(false)
        return
      }
      setValidatedToken(data)
      setScreen(data.requiresVerification ? 'verify' : 'distribute')
    } catch {
      setError('Network error. Try again.')
    }
    setLoading(false)
  }, [])

  const startQR = useCallback(async () => {
    setShowQR(true)
    // Dynamically import html5-qrcode to avoid SSR issues
    const { Html5Qrcode } = await import('html5-qrcode')
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decodedText: string) => {
        scanner.stop().catch(() => {})
        setShowQR(false)
        setTokenInput(decodedText)
        handleScan(decodedText)
      },
      () => {},
    ).catch(() => {
      setError('Camera unavailable. Enter code manually.')
      setShowQR(false)
    })
  }, [handleScan])

  const stopQR = useCallback(() => {
    if (scannerRef.current) {
      (scannerRef.current as { stop: () => Promise<void> }).stop().catch(() => {})
      scannerRef.current = null
    }
    setShowQR(false)
  }, [])

  const handleRedeem = useCallback(async (action: 'distributed' | 'pending') => {
    if (!validatedToken) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        tokenId: validatedToken.tokenId,
        action,
      }
      if (validatedToken.canAddExtras && extraNote.trim()) {
        body.extraNote = extraNote.trim()
        body.extraValueCents = extraValue ? Math.round(parseFloat(extraValue) * 100) : 0
      }
      const res = await fetch('/api/token/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Redemption failed')
        setLoading(false)
        return
      }
      setDoneMessage(
        action === 'distributed'
          ? 'Prize given. Record saved.'
          : 'Flagged for manager distribution.',
      )
      setDone(true)
    } catch {
      setError('Network error. Try again.')
    }
    setLoading(false)
  }, [validatedToken, extraNote, extraValue])

  const reset = useCallback(() => {
    setScreen('scan')
    setTokenInput('')
    setError(null)
    setValidatedToken(null)
    setExtraNote('')
    setExtraValue('')
    setDone(false)
    setDoneMessage('')
    stopQR()
  }, [stopQR])

  // Done confirmation screen
  if (done) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">✓</div>
        <p className="text-3xl font-bold text-green-400 mb-4">{doneMessage}</p>
        <button
          onClick={reset}
          className="mt-8 bg-white text-black text-xl font-bold px-10 py-5 rounded-2xl min-h-[64px]"
        >
          Scan next token
        </button>
      </div>
    )
  }

  // Screen 1: Scan / enter token
  if (screen === 'scan') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-6">
        <h1 className="text-white text-3xl font-bold tracking-wide">Employee Terminal</h1>
        <p className="text-gray-400 text-lg">Enter or scan a completion token</p>

        {error && (
          <div className="w-full max-w-sm bg-red-900 border border-red-500 rounded-xl p-4 text-red-200 text-center text-lg">
            {error}
          </div>
        )}

        {showQR ? (
          <div className="w-full max-w-sm">
            <div id="qr-reader" ref={qrRef} className="rounded-xl overflow-hidden" />
            <button
              onClick={stopQR}
              className="mt-4 w-full bg-gray-800 text-white text-xl py-4 rounded-2xl min-h-[64px]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col gap-4">
            <input
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleScan(tokenInput)}
              placeholder="TOKEN CODE"
              className="w-full bg-gray-900 text-white text-2xl font-mono tracking-widest text-center border-2 border-gray-600 rounded-xl px-4 py-5 min-h-[72px] focus:border-white outline-none"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button
              onClick={() => handleScan(tokenInput)}
              disabled={loading || !tokenInput.trim()}
              className="w-full bg-white text-black text-2xl font-bold py-5 rounded-2xl min-h-[72px] disabled:opacity-40"
            >
              {loading ? 'Checking…' : 'Validate Token'}
            </button>
            <button
              onClick={startQR}
              className="w-full bg-gray-800 text-white text-xl py-4 rounded-2xl min-h-[64px]"
            >
              📷 Scan QR Code
            </button>
          </div>
        )}
      </div>
    )
  }

  // Screen 2: Experience verification
  if (screen === 'verify' && validatedToken) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-sm">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Verification Required</p>
          <h2 className="text-white text-2xl font-bold mb-1">{validatedToken.collectorName}</h2>
          <p className="text-gray-300 text-lg mb-6">{validatedToken.passportTitle} — {validatedToken.pageTitle}</p>

          {validatedToken.verificationPrompt && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
              <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wider mb-2">Check</p>
              <p className="text-white text-xl">{validatedToken.verificationPrompt}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900 border border-red-500 rounded-xl p-4 text-red-200 text-center mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setScreen('distribute')}
              className="w-full bg-green-600 text-white text-2xl font-bold py-5 rounded-2xl min-h-[72px]"
            >
              ✓ Verified — Continue
            </button>
            <button
              onClick={reset}
              className="w-full bg-gray-800 text-gray-300 text-xl py-4 rounded-2xl min-h-[64px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Screen 3: Prize distribution — CANNOT be dismissed, both buttons create records
  if (screen === 'distribute' && validatedToken) {
    const hasPrize = !!validatedToken.prizeDescription
    const extrasRequired = validatedToken.canAddExtras && !!extraNote.trim() === false

    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-full max-w-sm">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Prize Distribution</p>
          <h2 className="text-white text-2xl font-bold mb-1">{validatedToken.collectorName}</h2>
          <p className="text-gray-300 text-lg mb-4">{validatedToken.passportTitle} — {validatedToken.pageTitle}</p>

          {hasPrize && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
              <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wider mb-1">Prize</p>
              <p className="text-white text-xl font-semibold">{validatedToken.prizeDescription}</p>
              {validatedToken.prizeValueCents && (
                <p className="text-gray-400 mt-1">
                  Value: ${(validatedToken.prizeValueCents / 100).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {validatedToken.canAddExtras && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
              <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wider mb-2">Extra Gift (Optional)</p>
              <input
                type="text"
                value={extraNote}
                onChange={e => setExtraNote(e.target.value)}
                placeholder="Describe extra (e.g. gift card #1234)"
                className="w-full bg-gray-800 text-white text-base border border-gray-600 rounded-xl px-4 py-3 mb-2 focus:border-white outline-none"
              />
              <input
                type="number"
                value={extraValue}
                onChange={e => setExtraValue(e.target.value)}
                placeholder="Value in USD (optional)"
                className="w-full bg-gray-800 text-white text-base border border-gray-600 rounded-xl px-4 py-3 focus:border-white outline-none"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-900 border border-red-500 rounded-xl p-4 text-red-200 text-center mb-4">
              {error}
            </div>
          )}

          <p className="text-gray-500 text-sm text-center mb-4">
            You must select one option below. This screen cannot be dismissed.
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => handleRedeem('distributed')}
              disabled={loading}
              className="w-full bg-green-600 text-white text-2xl font-bold py-5 rounded-2xl min-h-[72px] disabled:opacity-40"
            >
              {loading ? 'Saving…' : '🎁 Prize given · log it'}
            </button>
            <button
              onClick={() => handleRedeem('pending')}
              disabled={loading}
              className="w-full bg-yellow-600 text-white text-xl font-bold py-5 rounded-2xl min-h-[72px] disabled:opacity-40"
            >
              {loading ? 'Saving…' : '⏳ Manager will distribute later'}
            </button>
          </div>

          <p className="text-gray-600 text-xs text-center mt-6">
            Both options create an accountable record. No dismiss option.
          </p>
        </div>
      </div>
    )
  }

  return null
}
