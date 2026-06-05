import { redirect } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { loadDashboard } from '@/lib/dashboard/load'
import { getDashboardFlags } from '@/lib/dashboard/flags'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { HeroAlert } from '@/components/dashboard/HeroAlert'
import { AttentionQueue } from '@/components/dashboard/AttentionQueue'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { JumpTiles } from '@/components/dashboard/JumpTiles'
import { WelcomeMount } from '@/components/welcome/WelcomeMount'
import { WelcomeFooterLink } from '@/components/welcome/WelcomeFooterLink'
import { resolveWelcomeAudience } from '@/lib/welcome/audience'

export const metadata = { title: 'okuji' }

/**
 * Post-login operator dashboard. All visible numbers come from the
 * single batched `loadDashboard()` call — never more than one
 * round-trip group per render. Dormant KPIs / queue rows live in
 * code (flagged off) so activation is a one-line change once the
 * underlying feature ships; they NEVER render in production.
 *
 * Layout:
 *   Welcome header
 *   HeroAlert            (hidden when clean)
 *   KPI row              (3 visible in v1, layout reserves 5 slots)
 *   Two-column grid      (Attention 1.5fr  |  Activity 1fr)
 *   JumpTiles            (4-up compact row)
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Dashboard data + welcome audience run in parallel so the modal
  // resolution adds no extra waterfall hop.
  const [data, welcome] = await Promise.all([
    loadDashboard(supabase, user.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolveWelcomeAudience(supabase as any, user.id),
  ])
  const flags = getDashboardFlags()

  const greetName = data.firstName ?? data.displayName ?? 'there'
  const today = new Date()
  const subtitle = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ── Welcome header ───────────────────────────────────── */}
        <header className="mb-6">
          <h1
            className="text-[28px] font-bold text-ink"
            style={{ letterSpacing: '-0.01em' }}
          >
            Welcome back, {greetName}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {subtitle} · here&rsquo;s what needs you today
          </p>
        </header>

        {/* ── Hero alert (hidden when clean) ───────────────────── */}
        <HeroAlert audit={data.audit} />

        {/* ── KPI row ──────────────────────────────────────────── */}
        {/* Five cards, all visible. Three carry live counts; two
            (PRIZES GIVEN, PENDING DISTRIBUTION) render in honest-
            zero state with a muted "tracking coming soon" delta
            until their underlying mechanism ships. Flipping the
            flag in lib/dashboard/flags.ts changes nothing visually
            — the loader simply starts emitting real values.

            PENDING DISTRIBUTION's accent top-border (the "needs
            action" tone) is gated on value > 0 so the zero card
            stays calm. A zero card is never an alert. */}
        <section
          aria-label="Key metrics"
          className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <KpiCard kpi={data.kpis.published} href="/design" />
          <KpiCard kpi={data.kpis.acquired90d} />
          <KpiCard kpi={data.kpis.activeCollectors} />
          <KpiCard kpi={data.kpis.prizesGiven} />
          <KpiCard
            kpi={data.kpis.pendingDistribution}
            variant={typeof data.kpis.pendingDistribution.value === 'number' && data.kpis.pendingDistribution.value > 0 ? 'accent' : 'default'}
          />

          {/* DORMANT — TODO(activate-when-payments): SOLD remains
              hidden until paid-acquisition framing is the canonical
              one. The data exists (acquisitions.price_paid_cents +
              stripe_payment_intent_id) — see DASHBOARD_REVIEW.md
              review item 1. */}
          {flags.showSoldKpi && (
            <KpiCard kpi={{ label: 'Sold · 90d', value: '—' }} />
          )}
        </section>

        {/* ── Two-column working area ──────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <AttentionQueue items={data.attention} />
          <ActivityFeed items={data.activity} />
        </section>

        {/* ── Jump tiles ───────────────────────────────────────── */}
        <JumpTiles roles={data.roles} />

        {/* ── Footer ───────────────────────────────────────────── */}
        {/* Quiet "About okujiKōbō" link reopens the welcome modal —
            the only entry point for re-orientation. Kept here
            rather than in AppNav because the AppNav avatar has no
            dropdown primitive today; the footer adds 5 lines, no
            nav refactor. */}
        <footer className="mt-10 flex justify-center border-t border-surface-faintdiv pt-4">
          <WelcomeFooterLink />
        </footer>
      </main>

      {/* ── Welcome modal (first login only; re-openable from
            the footer via a window event) ────────────────────── */}
      <WelcomeMount
        audience={welcome.audience}
        institutionName={welcome.institutionName}
        initiallyOpen={welcome.welcomeSeenAt === null}
      />
    </div>
  )
}
