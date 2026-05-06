'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const next = searchParams.get('next') ?? '/'

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
    // On success the browser navigates away — no cleanup needed
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

    router.replace(next)
  }

  return (
    <div className="w-full max-w-sm">
      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <span className="text-4xl leading-none" aria-hidden="true">🧭</span>
        <h1 className="mt-3 font-serif text-2xl font-bold text-white tracking-tight">
          PanoplyConnect
        </h1>
        <p className="mt-1 text-sm text-panoply-gray-3">
          Sign in to your account
        </p>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div className="rounded-modal bg-white p-8 shadow-lg">
        {/* Error banner */}
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-panel bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
          >
            {error}
          </p>
        )}

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className={cn(
            'flex w-full items-center justify-center gap-3 rounded-panel border border-[#dadce0]',
            'bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043]',
            'hover:bg-[#f8f9fa] hover:border-[#c6c6c6] focus-visible:outline-none',
            'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4285f4]',
            'disabled:opacity-60 disabled:pointer-events-none transition-colors shadow-sm',
          )}
        >
          {/* Official Google G logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 border-t border-panoply-gray-2" />
          <span className="text-xs text-panoply-gray-3">or</span>
          <div className="flex-1 border-t border-panoply-gray-2" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-panoply-navy">
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
                'h-9 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 text-sm',
                'text-panoply-navy placeholder:text-panoply-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal',
                'transition-colors'
              )}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-panoply-navy">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(
                'h-9 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 px-3 text-sm',
                'text-panoply-navy placeholder:text-panoply-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal',
                'transition-colors'
              )}
              placeholder="••••••••"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className={cn(
              'mt-1 h-10 rounded-panel bg-panoply-teal px-4 text-sm font-medium text-white',
              'hover:bg-[#0F6E56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal',
              'disabled:opacity-50 disabled:pointer-events-none transition-colors'
            )}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-5 space-y-2 text-center text-sm text-panoply-gray-3">
          <p>
            No account?{' '}
            <Link
              href="/signup"
              className="font-medium text-panoply-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal rounded-sm"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
