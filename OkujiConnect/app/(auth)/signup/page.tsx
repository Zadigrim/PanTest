'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    // 1. Create the auth user
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
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

    router.replace('/')
  }

  return (
    <div className="w-full max-w-sm">
      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <span className="text-4xl leading-none" aria-hidden="true">🧭</span>
        <h1 className="mt-3 font-serif text-2xl font-bold text-white tracking-tight">
          OkujiConnect
        </h1>
        <p className="mt-1 text-sm text-okuji-gray-3">
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
            <label htmlFor="display_name" className="text-sm font-medium text-okuji-navy">
              Display name
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={cn(
                'h-9 rounded-panel border border-okuji-gray-2 bg-okuji-gray-1 px-3 text-sm',
                'text-okuji-navy placeholder:text-okuji-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal',
                'transition-colors'
              )}
              placeholder="Your name"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-okuji-navy">
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
                'h-9 rounded-panel border border-okuji-gray-2 bg-okuji-gray-1 px-3 text-sm',
                'text-okuji-navy placeholder:text-okuji-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal',
                'transition-colors'
              )}
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-okuji-navy">
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
                'h-9 rounded-panel border border-okuji-gray-2 bg-okuji-gray-1 px-3 text-sm',
                'text-okuji-navy placeholder:text-okuji-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-okuji-teal focus:border-okuji-teal',
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
              'mt-1 h-10 rounded-panel bg-okuji-teal px-4 text-sm font-medium text-white',
              'hover:bg-[#0F6E56] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal',
              'disabled:opacity-50 disabled:pointer-events-none transition-colors'
            )}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-5 text-center text-sm text-okuji-gray-3">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-okuji-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal rounded-sm"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
