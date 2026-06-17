'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Wordmark } from '@/components/moichido/Wordmark'
import { RingMark } from '@/components/moichido/marks/RingMark'

/**
 * Recovery landing form, host-branded. The recovery session is already in
 * cookies (set by /auth/callback) by the time we mount, so we verify it
 * with getUser(); no client-side code exchange (the browser client's PKCE
 * auto-detect would race a manual exchange). On success we updateUser the
 * new password and route the user into their own signed-in surface.
 */
export function UpdatePasswordClient({ isMoichido }: { isMoichido: boolean }) {
  const [phase, setPhase] = useState<'checking' | 'ready' | 'no-session' | 'done'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Verify the recovery session exists (the email link routed through
  // /auth/callback, which set it). No session ⇒ the link was invalid,
  // already used, or expired.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      setPhase(user ? 'ready' : 'no-session')
    })()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don’t match.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) {
      setError(updErr.message)
      setSaving(false)
      return
    }
    setPhase('done')
    // Into the signed-in surface. Hard redirect so the browser sends fresh
    // auth cookies (matches the login screens' window.location pattern).
    window.location.href = isMoichido ? '/moichido' : '/'
  }

  // ── Body per phase (chrome-agnostic; the wrappers below brand it) ────────
  let body: ReactNode
  if (phase === 'checking') {
    body = <p className={isMoichido ? 'text-sm text-moichido-muted' : 'text-sm text-muted'}>Checking your reset link…</p>
  } else if (phase === 'no-session') {
    body = (
      <div className="space-y-3">
        <p className={isMoichido ? 'text-sm text-moichido-ink' : 'text-sm text-navy'}>
          This reset link is invalid or has expired.
        </p>
        <a
          href={isMoichido ? '/moichido/auth/login' : '/login'}
          className={cn(
            'inline-block text-sm font-medium',
            isMoichido ? 'text-moichido-teal hover:underline' : 'text-green hover:underline',
          )}
        >
          ← Back to sign in
        </a>
      </div>
    )
  } else if (phase === 'done') {
    body = <p className={isMoichido ? 'text-sm text-moichido-ink' : 'text-sm text-navy'}>Password updated — signing you in…</p>
  } else {
    body = (
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && (
          <p
            role="alert"
            className={cn(
              'rounded-panel px-3 py-2 text-sm',
              isMoichido
                ? 'rounded-[8px] border border-moichido-apricot bg-moichido-apricot/10 text-moichido-ink'
                : 'border border-red-200 bg-red-50 text-red-700',
            )}
          >
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={cn('text-sm font-medium', isMoichido ? 'text-moichido-ink' : 'text-navy')}>
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass(isMoichido)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className={cn('text-sm font-medium', isMoichido ? 'text-moichido-ink' : 'text-navy')}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass(isMoichido)}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className={cn(
            'mt-1 h-10 px-4 text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none transition-colors',
            isMoichido
              ? 'rounded-[8px] bg-moichido-teal text-moichido-paper hover:opacity-90'
              : 'rounded-panel bg-green text-white hover:bg-[#0F6E56]',
          )}
        >
          {saving ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    )
  }

  return isMoichido ? <MoichidoChrome>{body}</MoichidoChrome> : <KoboChrome>{body}</KoboChrome>
}

function fieldClass(isMoichido: boolean) {
  return isMoichido
    ? 'h-9 rounded-[8px] border border-moichido-hairline bg-white px-3 text-sm text-moichido-ink placeholder:text-moichido-muted focus:outline-none focus:ring-2 focus:ring-moichido-teal focus:border-moichido-teal transition-colors'
    : 'h-9 rounded-panel border border-hairline bg-paper px-3 text-sm text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-green focus:border-green transition-colors'
}

// ── Surface chrome (mirrors the two auth layouts, since this route sits
//    outside both route-group layouts) ─────────────────────────────────────

function KoboChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
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
          <h1 className="mt-3 font-serif text-2xl font-bold text-white tracking-tight">okujiKobo</h1>
          <p className="mt-1 text-sm text-muted">Choose a new password</p>
        </div>
        <div className="rounded-modal bg-white p-8 shadow-lg">{children}</div>
      </div>
    </div>
  )
}

function MoichidoChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-moichido-teal font-moichido flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="text-moichido-apricot">
            <RingMark size={56} strokeWidth={2.4} />
          </span>
          <Wordmark className="mt-4 text-3xl text-moichido-paper" />
          <p className="mt-1 text-sm text-moichido-paper/60">Choose a new password</p>
        </div>
        <div className="rounded-[12px] bg-moichido-paper p-8 shadow-lg">{children}</div>
      </div>
    </div>
  )
}
