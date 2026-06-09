'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Wordmark } from '@/components/moichido/Wordmark'
import { RingMark } from '@/components/moichido/marks/RingMark'

/**
 * moichido merchant login. Same Supabase email/password + Google OAuth
 * shape as okuji's login — different chrome. Surface-isolated: imports
 * only moichido components and tokens; no okuji button/input styles.
 *
 * redirectTo for OAuth is computed from window.location.origin so it
 * stays on the moichido host (moichido.app/auth/callback). That URL
 * must be in Supabase Auth → Redirect URLs (Fix A from M4.1 diagnosis).
 * On success, the callback redirects back into the moichido surface
 * because /auth/callback is now excluded from the moichido rewrite,
 * and the post-exchange redirect uses request.origin.
 *
 * No signup. Pilot merchants are admin-provisioned per the M4.2 scope.
 */
export function MoichidoLoginForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (authError) {
      setError(authError.message)
      setGoogleLoading(false)
    }
    // On success the browser navigates away — no cleanup needed.
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    // Hard redirect so the browser sends a fresh request with new auth cookies.
    // router.replace() does a soft RSC navigation that can race with cookie
    // propagation — same pattern okuji's login uses.
    window.location.href = next
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="text-moichido-apricot">
          <RingMark size={56} strokeWidth={2.4} />
        </span>
        <Wordmark className="mt-4 text-3xl text-moichido-paper" />
        <p className="mt-1 text-sm text-moichido-paper/60">Merchant sign-in</p>
      </div>

      <div className="rounded-[12px] bg-moichido-paper p-8 shadow-lg">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-[8px] border border-moichido-apricot bg-moichido-apricot/10 px-3 py-2 text-sm text-moichido-ink"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="flex w-full items-center justify-center gap-3 rounded-[8px] border border-moichido-hairline bg-white px-4 py-2.5 text-sm font-medium text-moichido-ink hover:bg-moichido-paper disabled:opacity-60 disabled:pointer-events-none transition-colors shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
          </svg>
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 border-t border-moichido-hairline" />
          <span className="text-xs text-moichido-muted">or</span>
          <div className="flex-1 border-t border-moichido-hairline" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-moichido-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-[8px] border border-moichido-hairline bg-white px-3 text-sm text-moichido-ink placeholder:text-moichido-muted focus:outline-none focus:ring-2 focus:ring-moichido-teal focus:border-moichido-teal transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-moichido-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded-[8px] border border-moichido-hairline bg-white px-3 text-sm text-moichido-ink placeholder:text-moichido-muted focus:outline-none focus:ring-2 focus:ring-moichido-teal focus:border-moichido-teal transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="mt-1 h-10 rounded-[8px] bg-moichido-teal px-4 text-sm font-semibold text-moichido-paper hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-moichido-muted">
          Don&apos;t have an account? Pilot merchants are provisioned manually —
          contact your moichido representative.
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-moichido-paper/40">
        Looking for the okuji passport app? Visit okuji separately.
      </p>
    </div>
  )
}
