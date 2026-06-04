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

  const data = await loadDashboard(supabase, user.id)
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
        {/* 5-column-capable grid; v1 ships 3 cards. Dormant cards
            (SOLD, PRIZES GIVEN, PENDING DISTRIBUTION) live in code
            behind flags — see lib/dashboard/flags.ts. */}
        <section
          aria-label="Key metrics"
          className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <KpiCard kpi={data.kpis.published} href="/design" />
          <KpiCard kpi={data.kpis.acquired90d} />
          <KpiCard kpi={data.kpis.activeCollectors} />

          {/* DORMANT — TODO(activate-when-payments): expose paid
              acquisition count (price_paid_cents > 0 OR
              stripe_payment_intent_id IS NOT NULL) in the
              loader once the payment system is the real path. */}
          {flags.showSoldKpi && (
            <KpiCard kpi={{ label: 'Sold · 90d', value: '—' }} />
          )}

          {/* DORMANT — TODO(activate-when-prize-redemption): needs
              a redemption-tracking table; today prize_distributed
              is a flag on completion_tokens but "given vs
              redeemed" doesn't exist. */}
          {flags.showPrizesKpi && (
            <KpiCard kpi={{ label: 'Prizes given', value: '—' }} />
          )}

          {/* DORMANT — TODO(activate-when-employee-terminal): the
              employee distribution-terminal surface is unused
              today. Wire the variant='accent' top border to mark
              the action-required tone. */}
          {flags.showPendingDistributionKpi && (
            <KpiCard kpi={{ label: 'Pending distribution', value: '—' }} variant="accent" />
          )}
        </section>

        {/* ── Two-column working area ──────────────────────────── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <AttentionQueue items={data.attention} />
          <ActivityFeed items={data.activity} />
        </section>

        {/* ── Jump tiles ───────────────────────────────────────── */}
        <JumpTiles roles={data.roles} />
      </main>
    </div>
  )
}
