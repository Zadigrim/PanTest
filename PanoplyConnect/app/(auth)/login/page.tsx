'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

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

    const next = searchParams.get('next') ?? '/'
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
            disabled={loading}
            className={cn(
              'mt-1 h-10 rounded-panel bg-panoply-teal px-4 text-sm font-medium text-white',
              'hover:bg-[#0F6E56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal',
              'disabled:opacity-50 disabled:pointer-events-none transition-colors'
            )}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-5 text-center text-sm text-panoply-gray-3">
          No account?{' '}
          <Link
            href="/signup"
            className="font-medium text-panoply-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal rounded-sm"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
