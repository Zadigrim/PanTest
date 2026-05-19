import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { detectRoles, ROLE_LABELS } from '@/lib/roles'
import { getActiveRoleCookie } from '@/app/actions/role'
import AppNav from '@/components/layout/AppNav'
import type { OkujiConnectRole } from '@/lib/roles'

// ─── Role-access rules ────────────────────────────────────────────────────────

const SECTION_ACCESS: Record<string, OkujiConnectRole[]> = {
  design:  ['individual_creator', 'institutional_manager', 'designer', 'platform_admin', 'institutional_employee'],
  manage:  ['institutional_manager', 'individual_creator', 'platform_admin'],
  access:  ['institutional_manager', 'platform_admin'],
  assets:  ['individual_creator', 'institutional_manager', 'designer', 'platform_admin', 'institutional_employee'],
  explore: ['individual_creator', 'institutional_manager', 'designer', 'platform_admin', 'institutional_employee'],
  stops:   ['individual_creator', 'institutional_manager', 'designer', 'platform_admin', 'institutional_employee'],
}

// ─── Nav card definitions ─────────────────────────────────────────────────────

const NAV_CARDS = [
  {
    key:     'design',
    title:   'My Passports',
    href:    '/design',
    description: 'Create and manage your passport designs.',
    requiresRole: null as OkujiConnectRole | null,
  },
  {
    key:     'manage',
    title:   'Program Management',
    href:    '/manage',
    description: 'Manage passport programs, prizes, and collectors.',
    requiresRole: 'institutional_manager' as OkujiConnectRole,
  },
  {
    key:     'access',
    title:   'Access Management',
    href:    '/access',
    description: 'Control employee access and verification permissions.',
    requiresRole: 'institutional_manager' as OkujiConnectRole,
  },
  {
    key:     'assets',
    title:   'Asset Management',
    href:    '/assets',
    description: 'Organize media, emblems, and reusable design assets.',
    requiresRole: null as OkujiConnectRole | null,
  },
  {
    key:     'explore',
    title:   'Explore',
    href:    '/explore',
    description: 'Browse published passports from other creators.',
    requiresRole: null as OkujiConnectRole | null,
  },
  {
    key:     'stops',
    title:   'Educational Stop Library',
    href:    '/stops',
    description: 'Discover and import shared educational stops.',
    requiresRole: null as OkujiConnectRole | null,
  },
] as const

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  href?: string
}) {
  const inner = (
    <div className="rounded-panel border border-okuji-gray-2 bg-white p-5 transition-shadow hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-okuji-gray-3 mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold tabular-nums text-okuji-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-okuji-gray-3">{sub}</p>}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal rounded-panel">
        {inner}
      </Link>
    )
  }

  return inner
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  message,
  href,
  onDismiss,
}: {
  message: string
  href: string
  onDismiss?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-okuji-amber bg-amber-50 px-4 py-3">
      <span className="text-lg leading-none mt-0.5 shrink-0" aria-hidden="true">⚠</span>
      <div className="flex-1 min-w-0">
        <Link
          href={href}
          className="text-sm font-medium text-okuji-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal rounded-sm"
        >
          {message}
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Detect roles ────────────────────────────────────────────────────────────
  let roleContext = await detectRoles(supabase, user.id)

  const cookieRole = await getActiveRoleCookie()
  if (cookieRole && roleContext.roles.includes(cookieRole)) {
    roleContext = { ...roleContext, activeRole: cookieRole }
  }

  const { activeRole, roles } = roleContext

  // ── Profile for welcome message ──────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name ?? null

  // ── Fetch alerts ─────────────────────────────────────────────────────────────

  const alerts: { message: string; href: string }[] = []

  // Alert 1: pending distribution tokens
  if (roles.includes('institutional_manager') || roles.includes('institutional_employee')) {
    // Get institution IDs for this user's managed institutions
    const institutionIds = roleContext.institutions.map((i) => i.id)

    if (institutionIds.length > 0) {
      // Get passport IDs belonging to these institutions
      const { data: institutionPassports } = await supabase
        .from('passports')
        .select('id')
        .in('proprietor_id', institutionIds)

      const instPassportIds = (institutionPassports ?? []).map((p) => p.id)

      if (instPassportIds.length > 0) {
        const { count: pendingCount } = await supabase
          .from('completion_tokens')
          .select('id', { count: 'exact', head: true })
          .in('passport_id', instPassportIds)
          .eq('distribution_pending', true)
          .neq('prize_distributed', true)

        if (pendingCount && pendingCount > 0) {
          alerts.push({
            message: `${pendingCount} ${pendingCount === 1 ? 'prize' : 'prizes'} pending distribution`,
            href:    '/manage/prizes',
          })
        }
      }
    }
  }

  // Alert 2: published passports with stops missing GPS
  if (roles.includes('individual_creator') || roles.includes('institutional_manager')) {
    const { data: publishedPassports } = await supabase
      .from('passports')
      .select('id')
      .eq('creator_id', user.id)
      .eq('is_published', true)

    const publishedIds = (publishedPassports ?? []).map((p) => p.id)

    if (publishedIds.length > 0) {
      // Get all pages for these passports
      const { data: pages } = await supabase
        .from('passport_pages')
        .select('id')
        .in('passport_id', publishedIds)

      const pageIds = (pages ?? []).map((p) => p.id)

      if (pageIds.length > 0) {
        const { count: missingGpsCount } = await supabase
          .from('stops')
          .select('id', { count: 'exact', head: true })
          .in('page_id', pageIds)
          .or('lat.is.null,lng.is.null')

        if (missingGpsCount && missingGpsCount > 0) {
          alerts.push({
            message: `${missingGpsCount} ${missingGpsCount === 1 ? 'stop is' : 'stops are'} missing coordinates on published passports`,
            href:    '/design',
          })
        }
      }
    }
  }

  // ── Fetch headline metrics ───────────────────────────────────────────────────

  interface MetricItem {
    label: string
    value: string | number
    sub?: string
    href?: string
  }

  const metrics: MetricItem[] = []
  let hasAnyData = false

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartIso = monthStart.toISOString()

  if (activeRole === 'platform_admin') {
    hasAnyData = true

    const [
      { count: institutionCount },
      { count: publishedCount },
      { count: completionsCount },
      { count: pendingDist },
      { data: recentStamps },
    ] = await Promise.all([
      supabase.from('institutions').select('id', { count: 'exact', head: true }),
      supabase.from('passports').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('completion_tokens').select('id', { count: 'exact', head: true }).gte('generated_at', monthStartIso),
      supabase.from('completion_tokens').select('id', { count: 'exact', head: true }).eq('distribution_pending', true).neq('prize_distributed', true),
      supabase.from('stamps').select('user_id').gte('verified_at', cutoff),
    ])

    const activeCollectors = new Set((recentStamps ?? []).map((s: { user_id: string }) => s.user_id)).size

    if (institutionCount !== null) metrics.push({ label: 'Institutions', value: institutionCount, href: '/access' })
    if (publishedCount !== null)   metrics.push({ label: 'Published passports', value: publishedCount, href: '/explore' })
    if (activeCollectors > 0)      metrics.push({ label: 'Active collectors', value: activeCollectors, sub: 'Last 30 days' })
    if (completionsCount)          metrics.push({ label: 'Completions this month', value: completionsCount })
    if (pendingDist)               metrics.push({ label: 'Pending distributions', value: pendingDist, href: '/manage/prizes' })

  } else if (activeRole === 'individual_creator' || activeRole === 'designer') {
    // Passports published
    const { count: publishedCount } = await supabase
      .from('passports')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', user.id)
      .eq('is_published', true)

    if (publishedCount && publishedCount > 0) {
      metrics.push({ label: 'Passports published', value: publishedCount, href: '/design' })
      hasAnyData = true

      // Get published passport IDs for sub-queries
      const { data: pubPassports } = await supabase
        .from('passports')
        .select('id')
        .eq('creator_id', user.id)
        .eq('is_published', true)

      const pubPassportIds = (pubPassports ?? []).map((p) => p.id)

      if (pubPassportIds.length > 0) {
        // Active collectors (last 30 days)
        const { data: activeStamps } = await supabase
          .from('stamps')
          .select('user_id')
          .in('passport_id', pubPassportIds)
          .gte('verified_at', cutoff)

        const activeCollectors = new Set((activeStamps ?? []).map((s: { user_id: string }) => s.user_id)).size

        if (activeCollectors > 0) {
          metrics.push({ label: 'Active collectors', value: activeCollectors, sub: 'Last 30 days' })
        }

        // Revenue this month
        const { data: thisMonthAcq } = await supabase
          .from('acquisitions')
          .select('price_paid_cents')
          .in('passport_id', pubPassportIds)
          .gte('acquired_at', monthStartIso)

        const revenueCents = (thisMonthAcq ?? []).reduce(
          (sum: number, a: { price_paid_cents: number | null }) => sum + (a.price_paid_cents ?? 0),
          0
        )

        if (revenueCents > 0) {
          metrics.push({
            label: 'Revenue this month',
            value: `$${(revenueCents / 100).toFixed(2)}`,
          })
        }
      }
    }

  } else if (activeRole === 'institutional_manager') {
    const institutionIds = roleContext.institutions.map((i) => i.id)

    if (institutionIds.length > 0) {
      const { data: instPassports } = await supabase
        .from('passports')
        .select('id')
        .in('proprietor_id', institutionIds)

      const instPassportIds = (instPassports ?? []).map((p) => p.id)

      if (instPassportIds.length > 0) {
        hasAnyData = true

        // Active collectors
        const { data: activeStamps } = await supabase
          .from('stamps')
          .select('user_id')
          .in('passport_id', instPassportIds)
          .gte('verified_at', cutoff)

        const activeCollectors = new Set((activeStamps ?? []).map((s: { user_id: string }) => s.user_id)).size

        if (activeCollectors > 0) {
          metrics.push({ label: 'Active collectors', value: activeCollectors, sub: 'Last 30 days' })
        }

        // Completions this month
        const { count: completionsCount } = await supabase
          .from('completion_tokens')
          .select('id', { count: 'exact', head: true })
          .in('passport_id', instPassportIds)
          .gte('generated_at', monthStartIso)

        if (completionsCount && completionsCount > 0) {
          metrics.push({ label: 'Completions this month', value: completionsCount, href: '/manage' })
        }

        // Pending distributions
        const { count: pendingDist } = await supabase
          .from('completion_tokens')
          .select('id', { count: 'exact', head: true })
          .in('passport_id', instPassportIds)
          .eq('distribution_pending', true)
          .neq('prize_distributed', true)

        if (pendingDist && pendingDist > 0) {
          metrics.push({
            label: 'Pending distributions',
            value: pendingDist,
            href:  '/manage/prizes',
          })
        }
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <AppNav />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-okuji-navy">
            {displayName ? `Welcome back, ${displayName}` : 'OkujiConnect'}
          </h1>
          <p className="mt-1 text-sm text-okuji-gray-3">
            {ROLE_LABELS[activeRole]}
            {roles.length > 1 && (
              <span className="ml-2 text-okuji-gray-3">
                — {roles.length} roles active
              </span>
            )}
          </p>
        </div>

        {/* ── Zone 1: Alerts ────────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <section aria-label="Alerts" className="mb-8 space-y-3">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.href}
                message={alert.message}
                href={alert.href}
              />
            ))}
          </section>
        )}

        {/* ── Zone 2: Headline numbers ─────────────────────────────────────── */}
        {!hasAnyData ? (
          <div className="mb-8 rounded-panel border border-dashed border-okuji-gray-2 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-okuji-navy">
              Welcome to OkujiConnect.
            </p>
            <p className="mt-1 text-sm text-okuji-gray-3">
              Start by creating your first passport.
            </p>
            <Link
              href="/design"
              className="mt-4 inline-flex items-center justify-center rounded-panel bg-okuji-teal px-5 h-9 text-sm font-medium text-white hover:bg-okuji-teal-dk transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal"
            >
              Create a passport
            </Link>
          </div>
        ) : metrics.length > 0 ? (
          <section
            aria-label="Key metrics"
            className={`mb-8 grid gap-4 ${
              metrics.length === 1 ? 'grid-cols-1 max-w-xs' :
              metrics.length === 2 ? 'grid-cols-2 max-w-lg' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {metrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                sub={m.sub}
                href={m.href}
              />
            ))}
          </section>
        ) : null}

        {/* ── Zone 3: Navigation cards ─────────────────────────────────────── */}
        <section aria-label="Navigation">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-okuji-gray-3">
            Sections
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_CARDS.map((card) => {
              const allowed = SECTION_ACCESS[card.key]
              const hasAccess = roles.some((r) => allowed.includes(r))
              const hasPendingAlert = alerts.some((a) => a.href.startsWith(card.href))

              return (
                <Link
                  key={card.key}
                  href={hasAccess ? card.href : '#'}
                  aria-disabled={!hasAccess}
                  tabIndex={hasAccess ? 0 : -1}
                  title={
                    !hasAccess && card.requiresRole
                      ? `Requires ${ROLE_LABELS[card.requiresRole]} access`
                      : undefined
                  }
                  className={`
                    block rounded-card border border-okuji-gray-2 p-5
                    transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal
                    ${hasAccess
                      ? 'hover:shadow-md cursor-pointer'
                      : 'opacity-40 cursor-not-allowed pointer-events-none'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-okuji-navy">{card.title}</p>
                    {hasPendingAlert && (
                      <span
                        className="shrink-0 rounded-full bg-okuji-amber px-2 py-0.5 text-xs font-semibold text-white"
                        aria-label="Has pending alerts"
                      >
                        !
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-okuji-gray-3">{card.description}</p>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
