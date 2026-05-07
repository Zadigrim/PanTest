import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { CompletionToken, PassportPage, Stamp } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PassportRow {
  id: string
  title: string
  activeCollectors: number
  completions: number
  distributionPending: number
}

interface DashboardMetrics {
  activeCollectors: number
  tokensGenerated: number
  completionRate: number | null
  distributionPending: number
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string | number
  sub?: string
  warn?: boolean
}) {
  return (
    <div
      className={`bg-white rounded-panel border p-5 ${
        warn ? 'border-panoply-amber' : 'border-panoply-gray-2'
      }`}
    >
      <p className="text-xs font-medium text-panoply-gray-3 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-bold tabular-nums ${
          warn ? 'text-panoply-amber' : 'text-panoply-navy'
        }`}
      >
        {warn && <span aria-hidden="true">⚠ </span>}
        {value}
      </p>
      {sub && <p className="text-xs text-panoply-gray-3 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function ManageDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/manage')

  // Platform admins aren't in employee_authorizations — check that first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  const isPlatformAdmin = isAdminRpc === true

  let institutionId: string | null = null

  if (isPlatformAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: firstInst } = await (supabase as any)
      .from('institutions')
      .select('id')
      .limit(1)
      .single()
    institutionId = firstInst?.id ?? null
  } else {
    const { data: authorization } = await supabase
      .from('employee_authorizations')
      .select('institution_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    institutionId = authorization?.institution_id ?? null
  }

  // No institution access at all — layout already shows access-denied UI.
  if (!institutionId) return null

  // ── Fetch all passports belonging to this institution ──────────────────────
  const { data: passports } = await supabase
    .from('passports')
    .select('id, title')
    .eq('proprietor_id', institutionId)

  const passportList = passports ?? []
  const passportIds = passportList.map((p) => p.id)

  // ── Fetch all pages for these passports ────────────────────────────────────
  const { data: pages } = await supabase
    .from('passport_pages')
    .select('id, passport_id')
    .in('passport_id', passportIds.length > 0 ? passportIds : ['__none__'])

  const pageList: Pick<PassportPage, 'id' | 'passport_id'>[] = pages ?? []
  const pageIds = pageList.map((p) => p.id)

  // ── Fetch stops for these pages ────────────────────────────────────────────
  const { data: stops } = await supabase
    .from('stops')
    .select('id, page_id')
    .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])

  const stopIds = (stops ?? []).map((s) => s.id)

  // ── Fetch stamps (last 30 days) ────────────────────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()

  const { data: stamps } = await supabase
    .from('stamps')
    .select('id, user_id, stop_id, passport_id')
    .in('passport_id', passportIds.length > 0 ? passportIds : ['__none__'])
    .gte('verified_at', cutoff)

  const stampList: Pick<Stamp, 'id' | 'user_id' | 'stop_id' | 'passport_id'>[] = stamps ?? []

  // Active collectors: distinct user_ids from stamps
  const activeCollectors = new Set(stampList.map((s) => s.user_id)).size

  // ── Fetch completion tokens (last 30 days) ────────────────────────────────
  const { data: tokens } = await supabase
    .from('completion_tokens')
    .select('id, page_id, passport_id, redeemed_at, prize_distributed, distribution_pending')
    .in('passport_id', passportIds.length > 0 ? passportIds : ['__none__'])
    .gte('generated_at', cutoff)

  const tokenList: Pick<
    CompletionToken,
    'id' | 'page_id' | 'passport_id' | 'redeemed_at' | 'prize_distributed' | 'distribution_pending'
  >[] = tokens ?? []

  const tokensGenerated = tokenList.length
  const tokensRedeemed = tokenList.filter((t) => t.redeemed_at !== null).length
  const completionRate = tokensGenerated > 0 ? tokensRedeemed / tokensGenerated : null

  const distributionPendingTotal = tokenList.filter(
    (t) => t.distribution_pending === true && t.prize_distributed !== true,
  ).length

  const metrics: DashboardMetrics = {
    activeCollectors,
    tokensGenerated,
    completionRate,
    distributionPending: distributionPendingTotal,
  }

  // ── Per-passport row stats ─────────────────────────────────────────────────
  const pagesByPassport = new Map<string, string[]>()
  for (const page of pageList) {
    if (!pagesByPassport.has(page.passport_id)) pagesByPassport.set(page.passport_id, [])
    pagesByPassport.get(page.passport_id)!.push(page.id)
  }

  const stampsByPassport = new Map<string, Set<string>>()
  for (const stamp of stampList) {
    if (!stampsByPassport.has(stamp.passport_id)) stampsByPassport.set(stamp.passport_id, new Set())
    stampsByPassport.get(stamp.passport_id)!.add(stamp.user_id)
  }

  const tokensByPassport = new Map<string, typeof tokenList>()
  for (const token of tokenList) {
    if (!tokensByPassport.has(token.passport_id)) tokensByPassport.set(token.passport_id, [])
    tokensByPassport.get(token.passport_id)!.push(token)
  }

  const passportRows: PassportRow[] = passportList.map((passport) => {
    const passportTokens = tokensByPassport.get(passport.id) ?? []
    return {
      id: passport.id,
      title: passport.title,
      activeCollectors: stampsByPassport.get(passport.id)?.size ?? 0,
      completions: passportTokens.filter((t) => t.redeemed_at !== null).length,
      distributionPending: passportTokens.filter(
        (t) => t.distribution_pending === true && t.prize_distributed !== true,
      ).length,
    }
  })

  // Suppress unused-variable warning for stopIds (kept for downstream page-level queries)
  void stopIds

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-panoply-navy">Dashboard</h1>
        <p className="text-sm text-panoply-gray-3 mt-1">Last 30 days</p>
      </div>

      {/* Distribution pending global warning */}
      {metrics.distributionPending > 0 && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 bg-panoply-amber/10 border border-panoply-amber rounded-panel p-4"
        >
          <span className="text-xl leading-none mt-0.5" aria-hidden="true">⚠</span>
          <div>
            <p className="font-semibold text-panoply-navy text-sm">
              {metrics.distributionPending} prize{metrics.distributionPending !== 1 ? 's' : ''} pending distribution
            </p>
            <p className="text-xs text-panoply-gray-3 mt-0.5">
              Review the passport pages below and distribute outstanding prizes.
            </p>
          </div>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <MetricCard label="Active collectors" value={metrics.activeCollectors} />
        <MetricCard label="Prize tokens generated" value={metrics.tokensGenerated} />
        <MetricCard
          label="Completion rate"
          value={
            metrics.completionRate !== null
              ? `${Math.round(metrics.completionRate * 100)}%`
              : '—'
          }
          sub={
            metrics.tokensGenerated > 0
              ? `${tokensRedeemed} of ${metrics.tokensGenerated} redeemed`
              : undefined
          }
        />
        <MetricCard
          label="Distribution pending"
          value={metrics.distributionPending}
          warn={metrics.distributionPending > 0}
        />
      </div>

      {/* Passport table */}
      <section>
        <h2 className="text-base font-semibold text-panoply-navy mb-3">Your passports</h2>

        {passportRows.length === 0 ? (
          <p className="text-sm text-panoply-gray-3">
            No passports are linked to your institution yet.
          </p>
        ) : (
          <div className="bg-white rounded-panel border border-panoply-gray-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-panoply-gray-2 bg-panoply-gray-1">
                  <th className="px-4 py-3 text-left font-medium text-panoply-gray-3">
                    Passport name
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-panoply-gray-3">
                    Active collectors
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-panoply-gray-3">
                    Completions
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-panoply-gray-3">
                    Dist. pending
                  </th>
                </tr>
              </thead>
              <tbody>
                {passportRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-panoply-gray-2 last:border-0 hover:bg-panoply-gray-1 transition-colors ${
                      i % 2 === 1 ? 'bg-panoply-gray-1/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-panoply-navy">
                      <Link
                        href={`/manage/passport/${row.id}`}
                        className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal rounded-sm"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-panoply-navy">
                      {row.activeCollectors}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-panoply-navy">
                      {row.completions}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.distributionPending > 0 ? (
                        <span className="inline-flex items-center gap-1 text-panoply-amber font-semibold">
                          <span aria-hidden="true">⚠</span>
                          {row.distributionPending}
                        </span>
                      ) : (
                        <span className="text-panoply-gray-3">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
