'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CompletionToken, Profile } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// API response types (mirrors /api/analytics/[passportId])
// ---------------------------------------------------------------------------

interface StopEngagement {
  stopId: string
  stopName: string
  stampCount: number
  avgMoodRating: number | null
  avgPresenceDurationSeconds: number | null
  returnVisitRate: number | null
}

interface TokenStatusBreakdown {
  pageId: string
  total: number
  redeemed: number
  distributed: number
  pending: number
}

interface AnalyticsResponse {
  passportId: string
  stopEngagement: StopEngagement[]
  tokenStatus: TokenStatusBreakdown[]
  distributionPendingCount: number
}

// ---------------------------------------------------------------------------
// Token log row (joins token + collector profile)
// ---------------------------------------------------------------------------

interface TokenLogRow
  extends Pick<
    CompletionToken,
    | 'id'
    | 'token_code'
    | 'user_id'
    | 'page_id'
    | 'generated_at'
    | 'redeemed_at'
    | 'prize_distributed'
    | 'distribution_pending'
  > {
  collectorName: string | null
}

// ---------------------------------------------------------------------------
// Completions-per-day for bar chart
// ---------------------------------------------------------------------------

interface DayBucket {
  date: string   // YYYY-MM-DD
  count: number
}

function buildDayBuckets(tokens: TokenLogRow[]): DayBucket[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 29)
  cutoff.setHours(0, 0, 0, 0)

  const map = new Map<string, number>()
  // seed 30 days
  for (let i = 0; i < 30; i++) {
    const d = new Date(cutoff)
    d.setDate(d.getDate() + i)
    map.set(d.toISOString().slice(0, 10), 0)
  }

  for (const t of tokens) {
    if (!t.redeemed_at) continue
    const day = t.redeemed_at.slice(0, 10)
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

// ---------------------------------------------------------------------------
// SVG Bar Chart — completions per day, no library
// ---------------------------------------------------------------------------

function CompletionsBarChart({ buckets }: { buckets: DayBucket[] }) {
  const chartW = 640
  const chartH = 160
  const padL = 32
  const padR = 8
  const padT = 8
  const padB = 28
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB

  const maxVal = Math.max(...buckets.map((b) => b.count), 1)
  const barW = innerW / buckets.length - 2

  return (
    <svg
      viewBox={`0 0 ${chartW} ${chartH}`}
      className="w-full"
      aria-label="Completions per day bar chart"
      role="img"
    >
      {/* Y-axis ticks */}
      {[0, Math.ceil(maxVal / 2), maxVal].map((tick) => {
        const y = padT + innerH - (tick / maxVal) * innerH
        return (
          <g key={tick}>
            <line
              x1={padL}
              y1={y}
              x2={chartW - padR}
              y2={y}
              stroke="#E8EEF0"
              strokeWidth="1"
            />
            <text
              x={padL - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#64748B"
            >
              {tick}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {buckets.map((bucket, i) => {
        const x = padL + i * (innerW / buckets.length) + 1
        const barH = (bucket.count / maxVal) * innerH
        const y = padT + innerH - barH

        // Show x-axis label every 5 days to avoid clutter
        const showLabel = i % 5 === 0
        const labelDate = bucket.date.slice(5) // MM-DD

        return (
          <g key={bucket.date}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH || 1}
              fill={bucket.count > 0 ? '#1D9E75' : '#E1F5EE'}
              rx="2"
            >
              <title>{`${bucket.date}: ${bucket.count} completion${bucket.count !== 1 ? 's' : ''}`}</title>
            </rect>
            {showLabel && (
              <text
                x={x + barW / 2}
                y={chartH - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#64748B"
              >
                {labelDate}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// "Mark as distributed" button — client action
// ---------------------------------------------------------------------------

function MarkDistributedButton({
  tokenId,
  tokenCode,
  onDistributed,
}: {
  tokenId: string
  tokenCode: string
  onDistributed: (tokenId: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/token/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenCode, action: 'distributed' }),
      })
      if (res.ok) {
        onDistributed(tokenId)
      } else {
        const json = (await res.json()) as { error?: string }
        setError(json.error ?? 'Failed to mark as distributed')
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-panel text-xs font-medium bg-green text-white hover:bg-[#0F6E56] disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        {isPending ? 'Saving…' : '✓ Mark distributed'}
      </button>
      {error && <span className="text-xs text-accent">{error}</span>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Token status badge
// ---------------------------------------------------------------------------

function TokenStatusBadge({
  token,
}: {
  token: Pick<TokenLogRow, 'redeemed_at' | 'prize_distributed' | 'distribution_pending'>
}) {
  if (token.prize_distributed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cream text-green">
        Distributed
      </span>
    )
  }
  if (token.redeemed_at) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent">
        Redeemed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-hairline text-muted">
      Pending
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PassportAnalyticsPage() {
  const params = useParams()
  const passportId = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '')

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [tokens, setTokens] = useState<TokenLogRow[]>([])
  const [passportTitle, setPassportTitle] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch analytics + token log
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      // Analytics from API route
      const analyticsRes = await fetch(`/api/analytics/${passportId}`)
      if (!analyticsRes.ok) {
        const json = (await analyticsRes.json()) as { error?: string }
        throw new Error(json.error ?? 'Failed to load analytics')
      }
      const analyticsData = (await analyticsRes.json()) as AnalyticsResponse
      setAnalytics(analyticsData)

      // Token log + collector names via Supabase browser client
      const supabase = createClient()

      // Passport title
      const { data: passport } = await supabase
        .from('passports')
        .select('title')
        .eq('id', passportId)
        .single()
      setPassportTitle(passport?.title ?? 'Passport')

      // Completion tokens
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: tokenRows, error: tokenErr } = await supabase
        .from('completion_tokens')
        .select(
          'id, token_code, user_id, page_id, generated_at, redeemed_at, prize_distributed, distribution_pending',
        )
        .eq('passport_id', passportId)
        .gte('generated_at', thirtyDaysAgo.toISOString())
        .order('generated_at', { ascending: false })

      if (tokenErr) throw new Error(tokenErr.message)

      const rawTokens = tokenRows ?? []
      const uniqueUserIds = [...new Set(rawTokens.map((t) => t.user_id))]

      // Bulk fetch collector display names
      let profileMap = new Map<string, string | null>()
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', uniqueUserIds)
        for (const p of profiles ?? []) {
          profileMap.set(p.id, p.display_name)
        }
      }

      const enriched: TokenLogRow[] = rawTokens.map((t) => ({
        id: t.id,
        token_code: t.token_code,
        user_id: t.user_id,
        page_id: t.page_id,
        generated_at: t.generated_at,
        redeemed_at: t.redeemed_at,
        prize_distributed: t.prize_distributed,
        distribution_pending: t.distribution_pending,
        collectorName: profileMap.get(t.user_id) ?? null,
      }))

      setTokens(enriched)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [passportId])

  useEffect(() => {
    if (passportId) loadData()
  }, [passportId, loadData])

  // When a token is marked distributed, update local state
  function handleDistributed(tokenId: string) {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === tokenId ? { ...t, prize_distributed: true, distribution_pending: false } : t,
      ),
    )
    setAnalytics((prev) =>
      prev ? { ...prev, distributionPendingCount: Math.max(0, prev.distributionPendingCount - 1) } : prev,
    )
  }

  const dayBuckets = buildDayBuckets(tokens)
  const pendingTokens = tokens.filter(
    (t) => t.distribution_pending === true && t.prize_distributed !== true,
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <p className="text-muted text-sm animate-pulse">Loading analytics…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-8">
        <div
          role="alert"
          className="bg-accent/10 border border-accent rounded-panel p-4 text-accent text-sm"
        >
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">{passportTitle}</h1>
        <p className="text-sm text-muted mt-1">Analytics · Last 30 days</p>
      </div>

      {/* ── 1. Stop engagement table ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-navy mb-3">Stop engagement</h2>
        {analytics && analytics.stopEngagement.length > 0 ? (
          <div className="bg-white rounded-panel border border-hairline overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <th className="px-4 py-3 text-left font-medium text-muted">Stop name</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Stamps</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Avg dwell</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Return visits</th>
                  <th className="px-4 py-3 text-right font-medium text-muted">Mood rating</th>
                </tr>
              </thead>
              <tbody>
                {analytics.stopEngagement.map((stop, i) => (
                  <tr
                    key={stop.stopId}
                    className={`border-b border-hairline last:border-0 ${
                      i % 2 === 1 ? 'bg-paper/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-navy">{stop.stopName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">
                      {stop.stampCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {stop.avgPresenceDurationSeconds !== null
                        ? `${Math.round(stop.avgPresenceDurationSeconds / 60)}m`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {stop.returnVisitRate !== null
                        ? `${Math.round(stop.returnVisitRate * 100)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {stop.avgMoodRating !== null
                        ? stop.avgMoodRating.toFixed(1)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No stop data available yet.</p>
        )}
      </section>

      {/* ── 2. Completions bar chart ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-navy mb-3">Completions per day</h2>
        <div className="bg-white rounded-panel border border-hairline p-4">
          <CompletionsBarChart buckets={dayBuckets} />
          <p className="text-xs text-muted mt-2 text-right">Last 30 days</p>
        </div>
      </section>

      {/* ── 3. Token redemption log ──────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-navy mb-3">Token redemption log</h2>
        {tokens.length > 0 ? (
          <div className="bg-white rounded-panel border border-hairline overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <th className="px-4 py-3 text-left font-medium text-muted">Token code</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Collector</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Generated</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`border-b border-hairline last:border-0 ${
                      i % 2 === 1 ? 'bg-paper/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-navy">{t.token_code}</td>
                    <td className="px-4 py-3 text-navy">
                      {t.collectorName ?? <span className="text-muted italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums text-xs">
                      {new Date(t.generated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <TokenStatusBadge token={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No tokens generated yet.</p>
        )}
      </section>

      {/* ── 4. Distribution pending queue ───────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-navy">Distribution pending</h2>
          {pendingTokens.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent">
              ⚠ {pendingTokens.length}
            </span>
          )}
        </div>

        {pendingTokens.length === 0 ? (
          <p className="text-sm text-muted">
            No prizes pending distribution — all clear.
          </p>
        ) : (
          <div className="bg-white rounded-panel border border-accent overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-accent/5">
                  <th className="px-4 py-3 text-left font-medium text-muted">Token code</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Collector</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Generated</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingTokens.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`border-b border-hairline last:border-0 ${
                      i % 2 === 1 ? 'bg-paper/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-navy">{t.token_code}</td>
                    <td className="px-4 py-3 text-navy">
                      {t.collectorName ?? <span className="text-muted italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums text-xs">
                      {new Date(t.generated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <MarkDistributedButton
                        tokenId={t.id}
                        tokenCode={t.token_code}
                        onDistributed={handleDistributed}
                      />
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
