import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'

// ─── Marketplace Header ───────────────────────────────────────────────────────

async function MarketplaceHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let avatarUrl:   string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()

    displayName = profile?.display_name ?? null
    avatarUrl   = profile?.avatar_url   ?? null
  }

  return (
    <header className="sticky top-0 z-30 border-b border-panoply-gray-2 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">

        {/* ── Wordmark ────────────────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
        >
          <span className="text-xl leading-none" aria-hidden="true">🧭</span>
          <span className="font-serif text-lg font-bold text-panoply-navy tracking-tight">
            Panoply
          </span>
        </Link>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="flex flex-1 justify-center px-2 sm:px-4">
          <div className="relative w-full max-w-xl">
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-panoply-gray-3"
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search passports, places, creators…"
              className={cn(
                'h-9 w-full rounded-panel border border-panoply-gray-2 bg-panoply-gray-1',
                'pl-9 pr-3 text-sm text-panoply-navy placeholder:text-panoply-gray-3',
                'focus:outline-none focus:ring-2 focus:ring-panoply-teal focus:border-panoply-teal transition-colors'
              )}
            />
          </div>
        </div>

        {/* ── Right side ──────────────────────────────────────────────────── */}
        <nav className="flex shrink-0 items-center gap-2" aria-label="Site navigation">
          {user ? (
            <>
              <Link
                href="/library"
                className={cn(
                  'hidden sm:inline-flex items-center rounded-panel px-3 h-9 text-sm font-medium',
                  'text-panoply-navy hover:bg-panoply-gray-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
                )}
              >
                My Library
              </Link>

              {/* Avatar / initials */}
              <Link
                href="/profile"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full overflow-hidden',
                  'border-2 border-panoply-gray-2 hover:border-panoply-teal transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
                )}
                aria-label={`Profile: ${displayName ?? user.email}`}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName ?? 'Your avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-panoply-teal text-white text-xs font-semibold select-none">
                    {(displayName ?? user.email ?? '?')[0].toUpperCase()}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  'inline-flex items-center rounded-panel px-3 h-9 text-sm font-medium',
                  'text-panoply-navy hover:bg-panoply-gray-2 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  'inline-flex items-center rounded-panel px-3 h-9 text-sm font-medium',
                  'bg-panoply-teal text-white hover:bg-[#0F6E56] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
                )}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketplaceHeader />
      <main>{children}</main>
    </div>
  )
}
