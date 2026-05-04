'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AcquireButtonProps {
  passportId: string
  isFree:     boolean
  priceCents: number | null
  isOwned:    boolean
  isLoggedIn: boolean
  title:      string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AcquireButton({
  passportId,
  isFree,
  priceCents,
  isOwned,
  isLoggedIn,
  title,
}: AcquireButtonProps) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Not logged in ───────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <a
        href={`/login?next=/passport/${passportId}`}
        className={cn(
          'inline-flex h-11 items-center justify-center rounded-panel px-6 text-sm font-semibold',
          'bg-panoply-teal text-white hover:bg-[#0F6E56] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
        )}
      >
        Sign in to start
      </a>
    )
  }

  // ── Already owned ───────────────────────────────────────────────────────────
  if (isOwned) {
    return (
      <a
        href={`/collect/${passportId}`}
        className={cn(
          'inline-flex h-11 items-center justify-center rounded-panel px-6 text-sm font-semibold',
          'border-2 border-panoply-teal bg-white text-panoply-teal hover:bg-panoply-teal-lt transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
        )}
      >
        Continue collecting →
      </a>
    )
  }

  // ── Free: acquire directly ──────────────────────────────────────────────────
  async function handleFreeAcquire() {
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/login?next=/passport/${passportId}`)
      return
    }

    const { error: apiError } = await supabase
      .from('acquisitions')
      .upsert(
        {
          user_id:          user.id,
          passport_id:      passportId,
          price_paid_cents: 0,
        },
        { onConflict: 'user_id,passport_id' }
      )

    if (apiError) {
      setError(apiError.message)
      setLoading(false)
      return
    }

    router.push(`/collect/${passportId}`)
  }

  // ── Paid: go to checkout ────────────────────────────────────────────────────
  async function handlePaidCheckout() {
    setError(null)
    setLoading(true)

    const res = await fetch('/api/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ passportId }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      setError(body.error ?? 'Checkout unavailable. Please try again.')
      setLoading(false)
      return
    }

    const { url } = await res.json() as { url?: string }
    if (url) {
      window.location.href = url
    } else {
      setError('No checkout URL returned.')
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const priceLabel = priceCents != null
    ? `$${(priceCents / 100).toFixed(2)}`
    : null

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={isFree ? handleFreeAcquire : handlePaidCheckout}
        aria-label={isFree ? `Start ${title}` : `Get ${title}${priceLabel ? ` · ${priceLabel}` : ''}`}
        className={cn(
          'inline-flex h-11 items-center justify-center gap-2 rounded-panel px-6 text-sm font-semibold',
          'bg-panoply-teal text-white hover:bg-[#0F6E56] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            {isFree ? 'Starting…' : 'Redirecting…'}
          </>
        ) : isFree ? (
          'Start this passport'
        ) : priceLabel ? (
          `Get this passport · ${priceLabel}`
        ) : (
          'Get this passport'
        )}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
