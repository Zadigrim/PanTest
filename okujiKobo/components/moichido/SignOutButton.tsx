'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Moichido merchant sign-out. Clears the moichido.app session
 * cookie via Supabase auth.signOut(). Per the M4.2 decision,
 * the okuji.app session (if any) is untouched — cookies are
 * host-scoped, so a dual-role user remains signed in to okuji
 * after signing out of moichido. Surface isolation extends to
 * logout.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false)
  async function handleClick() {
    if (pending) return
    setPending(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Hard nav so the next request hits middleware unauthenticated
    // and lands on /moichido/auth/login cleanly.
    window.location.href = '/moichido/auth/login'
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-[8px] border border-moichido-hairline bg-white px-3 py-1.5 text-xs font-semibold text-moichido-ink hover:bg-moichido-paper disabled:opacity-40"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
