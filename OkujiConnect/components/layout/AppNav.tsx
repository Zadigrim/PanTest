import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { detectRoles } from '@/lib/roles'
import { getActiveRoleCookie } from '@/app/actions/role'
import { RoleSwitcher } from './RoleSwitcher'
import { cn } from '@/lib/cn'

// ─── Nav section definitions ──────────────────────────────────────────────────

const BASE_NAV = [
  { label: 'My Passports', href: '/design' },
  { label: 'Program',      href: '/manage' },
  { label: 'Assets',       href: '/assets' },
  { label: 'Explore',      href: '/explore' },
  { label: 'Stop Library', href: '/stops' },
] as const

// ─── AppNav ───────────────────────────────────────────────────────────────────

export default async function AppNav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Determine current path for active-link highlighting
  const headersList = headers()
  const currentPath = headersList.get('x-pathname') ?? ''

  let displayName: string | null = null
  let avatarUrl:   string | null = null
  let roleContext: Awaited<ReturnType<typeof detectRoles>> | null = null
  let canAccessManagement = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()

    displayName = profile?.display_name ?? null
    avatarUrl   = profile?.avatar_url   ?? null
    roleContext  = await detectRoles(supabase, user.id)

    // detectRoles() now includes is_platform_admin() RPC check internally
    canAccessManagement =
      roleContext.roles.includes('platform_admin') ||
      roleContext.roles.includes('institutional_manager') ||
      roleContext.roles.includes('institutional_employee')

    // Apply cookie-stored active role if valid
    const cookieRole = await getActiveRoleCookie()
    if (cookieRole && roleContext.roles.includes(cookieRole)) {
      roleContext = { ...roleContext, activeRole: cookieRole }
    }
  }

  const initials = (displayName ?? user?.email ?? '?')[0].toUpperCase()

  return (
    <header
      className="sticky top-0 z-40 h-14 bg-navy border-b border-white/10"
      aria-label="Global navigation"
    >
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4 px-4 sm:px-6">

        {/* ── Wordmark ────────────────────────────────────────────────────── */}
        <Link
          href="/"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green'
          )}
          aria-label="OkujiConnect home"
        >
          <span className="text-xl leading-none" aria-hidden="true">🧭</span>
          <span className="font-serif text-lg font-bold text-white tracking-tight hidden sm:inline">
            Okuji
          </span>
        </Link>

        {/* ── Center nav links ─────────────────────────────────────────────── */}
        <nav
          className="flex flex-1 items-center justify-center gap-0.5 overflow-x-auto scrollbar-none"
          aria-label="Section navigation"
        >
          {BASE_NAV.map(({ label, href }) => {
            const isActive = currentPath === href || currentPath.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'whitespace-nowrap rounded-panel px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-[#A8C0CE] hover:bg-white/10 hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            )
          })}
          {canAccessManagement && (() => {
            const href = '/access'
            const isActive = currentPath === href || currentPath.startsWith(href + '/')
            return (
              <Link
                href={href}
                className={cn(
                  'whitespace-nowrap rounded-panel px-3 py-1.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-[#A8C0CE] hover:bg-white/10 hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                Access
              </Link>
            )
          })()}
        </nav>

        {/* ── Right side ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Role switcher — always visible when user has multiple roles */}
          {roleContext && roleContext.roles.length > 1 && (
            <RoleSwitcher
              roles={roleContext.roles}
              activeRole={roleContext.activeRole}
            />
          )}

          {/* Avatar / initials */}
          {user ? (
            <Link
              href="/profile"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full overflow-hidden shrink-0',
                'border-2 border-white/20 hover:border-green transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green'
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
                <span className="flex h-full w-full items-center justify-center bg-green text-white text-xs font-semibold select-none">
                  {initials}
                </span>
              )}
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center rounded-panel px-3 h-8 text-sm font-medium',
                'text-white bg-green hover:bg-green transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green'
              )}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
