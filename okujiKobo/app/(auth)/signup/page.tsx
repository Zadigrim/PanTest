'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'

export default function SignupPage() {
  const router = useRouter()

  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  // After a successful signUp where Supabase didn't return a session
  // (because email-confirmation is on), we show the "check your email"
  // pane instead of redirecting. The user clicks the link in the email
  // and lands at /auth/callback which exchanges the code and signs them
  // in. Google OAuth signups still land in the regular logged-in flow.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // 1. Create the auth user. emailRedirectTo points at the existing
    // /auth/callback route which already handles exchangeCodeForSession
    // for both OAuth and PKCE email-confirmation links.
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError || !signUpData.user) {
      setError(authError?.message ?? 'Sign-up failed. Please try again.')
      setLoading(false)
      return
    }

    // 2. Upsert profile row (a DB trigger may already create it; upsert is safe either way)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id:           signUpData.user.id,
          display_name: displayName.trim() || null,
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      // Non-fatal — auth succeeded; profile can be fixed later
      console.warn('Profile upsert warning:', profileError.message)
    }

    // Supabase returns session=null when email confirmation is required.
    // session is non-null only when confirmation is off (existing
    // pre-confirmation accounts) or for non-confirmable providers.
    if (!signUpData.session) {
      setAwaitingConfirmation(email)
      setLoading(false)
      return
    }

    router.replace('/')
  }

  async function handleResend() {
    if (!awaitingConfirmation) return
    setResendStatus('sending')
    const supabase = createClient()
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: awaitingConfirmation,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setResendStatus(resendErr ? 'error' : 'sent')
  }

  if (awaitingConfirmation) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl leading-none" aria-hidden="true">📨</span>
          <h1 className="mt-3 font-serif text-2xl font-bold text-white tracking-tight">
            Check your email
          </h1>
        </div>
        <div className="rounded-modal bg-white p-8 shadow-lg text-sm text-navy space-y-4">
          <p>
            We sent a verification link to <strong>{awaitingConfirmation}</strong>. Click it to finish creating your account.
          </p>
          <p className="text-muted">
            Didn&apos;t get it? Check spam, then try resending.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendStatus === 'sending' || resendStatus === 'sent'}
            className={cn(
              'h-10 w-full rounded-panel bg-green px-4 text-sm font-medium text-white',
              'hover:bg-[#0F6E56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green',
              'disabled:opacity-50 disabled:pointer-events-none transition-colors',
            )}
          >
            {resendStatus === 'sending' && 'Sending…'}
            {resendStatus === 'sent' && 'Sent — check your inbox'}
            {resendStatus === 'error' && 'Couldn’t resend — try again'}
            {resendStatus === 'idle' && 'Resend verification email'}
          </button>
          <p className="text-center text-sm text-muted">
            Once verified,{' '}
            <Link href="/login" className="font-medium text-green hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <Image
          src="/appicon/png-rounded/okuji-icon-rounded-256.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto h-14 w-14 rounded-[12px]"
          priority
          aria-hidden="true"
        />
        <h1 className="mt-3 font-serif text-2xl font-bold text-white tracking-tight">
          okujiKobo
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create your account
        </p>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div className="rounded-modal bg-white p-8 shadow-lg">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

          {/* Error banner */}
          {error && (
            <p
              role="alert"
              className="rounded-panel bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
            >
              {error}
            </p>
          )}

          {/* Display name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="display_name" className="text-sm font-medium text-navy">
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={cn(
                'h-9 rounded-panel border border-hairline bg-paper px-3 text-sm',
                'text-navy placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-green focus:border-green',
                'transition-colors'
              )}
              placeholder="Your name"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-navy">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                'h-9 rounded-panel border border-hairline bg-paper px-3 text-sm',
                'text-navy placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-green focus:border-green',
                'transition-colors'
              )}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-navy">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'h-9 rounded-panel border border-hairline bg-paper px-3 text-sm',
                'text-navy placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-green focus:border-green',
                'transition-colors'
              )}
              placeholder="At least 6 characters"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'mt-1 h-10 rounded-panel bg-green px-4 text-sm font-medium text-white',
              'hover:bg-[#0F6E56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green',
              'disabled:opacity-50 disabled:pointer-events-none transition-colors'
            )}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-sm"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
