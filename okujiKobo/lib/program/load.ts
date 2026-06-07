/**
 * Program — Overview data loader.
 *
 * Batched fetch for the institutional Overview tab. Every visible
 * number on the Overview surface traces to one of the queries in
 * this file; nothing illustrative, nothing fabricated.
 *
 * Scope (per Nathan's spec):
 *   - This is the INSTITUTION's own view. ownedIds is the
 *     intersection of "passports the caller can manage" — same
 *     ownership-OR shape used by /api/dashboard and /program v1.
 *   - Aggregate counts only. No per-collector identity ever
 *     surfaces (matches the dashboard's "how many and when,
 *     never who" rule).
 *   - Real queries only. The two cards that don't have a data
 *     source yet (Prizes Redeemed by collector) are NOT computed
 *     here — they live in /lib/dashboard/flags.ts territory and
 *     render at honest zero in the UI.
 *
 * Completion rate definition:
 *   A collector is "complete" on a passport when their distinct
 *   stamped stop-ids cover EVERY stop in that passport (any
 *   experience_type, any verification_method — honor-only stops
 *   count the same as gps stops; the rule is stop coverage, not
 *   verification path).
 *   Rate = unique completing collectors ÷ unique acquirers,
 *          across the institution's published passports.
 *   Honest zero when there are no acquirers yet.
 *
 * Trend (acquisitions by week, last 12 weeks):
 *   Histogram from acquired_at. Per the spec, the UI hides the
 *   chart and renders a "since {date}" label when total acquisitions
 *   are too few to be meaningful (<12 across all weeks); the gate
 *   sits in the renderer, not here — load returns the raw weekly
 *   counts so the caller decides the threshold.
 *
 * NO new tables, NO event log, NO analytics SDK. Everything below
 * is derived from rows already in: passports, passport_pages,
 * stops, acquisitions, stamps, completion_tokens.
 */

import { runPublishChecklist, type PublishStop } from '@/lib/design/publish-checklist'
import { callerHasFlag } from '@/lib/roles/require-flag'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const TREND_WEEKS = 12
const ATTENTION_NO_ACQUISITIONS_DAYS = 14

// ── Output shape ────────────────────────────────────────────────────────────

export interface ProgramOverview {
  // Top KPI band — six cards. Two are honest-zero placeholders for
  // KI-02 (collector-side redemption tracking); see comments below.
  kpis: {
    activeCollectors30d:  number
    acquisitions90d:      number
    stampsPlaced90d:      number
    completionRatePct:    number | null  // null when zero acquirers
    prizesHandedOut:      number          // staff-marked distribution (real today)
    pendingDistribution:  number          // real today; needs the terminal to act on it
    // KI-02 territory: when collector redemption ships, add
    // prizesRedeemed and the two zero-placeholders below disappear.
  }
  // Per-passport rows on the Overview surface. One row per passport
  // the caller owns — drafts AND published, sorted with published
  // first (then by last activity desc).
  perPassport: Array<{
    id: string
    title: string
    status: string
    isPublished: boolean
    acquisitions: number              // all-time
    activeCollectors30d: number
    stampsPlaced90d: number
    completionPct: number | null      // null → no acquirers
    lastActivity: string | null       // ISO; max(stamp.verified_at, acquisition.acquired_at)
  }>
  // 12 weekly buckets (oldest → newest) of acquisition counts
  // across this institution's passports. The renderer decides
  // whether to draw a sparkline or fall back to a "since {date}"
  // label based on totals.
  trend: {
    weeklyAcquisitions: number[]
    weekStartIsos: string[]
    firstAcquisitionAt: string | null
  }
  // Needs-Attention items — drafts close to publish, published with
  // no acquisitions after N days, published with no prize text on
  // any page. Real queries only; same rules as the main dashboard's
  // Needs Attention.
  attention: Array<{
    id: string
    severity: 'info' | 'warn' | 'error'
    title: string
    meta: string
    ctaLabel: string
    ctaHref: string
  }>
  // For honesty banners in the UI.
  totals: {
    ownedPassports: number
    publishedPassports: number
  }
}

// ── Loader ──────────────────────────────────────────────────────────────────

export async function loadProgramOverview(
  supabase: AnySupabase,
  userId: string,
  institutionIds: string[],
): Promise<ProgramOverview> {
  // can_view_analytics gate (Phase 2, KI-03 closure). For each
  // institution the caller belongs to, check whether they hold
  // can_view_analytics; institutions where they don't are dropped
  // from the analytics scope. Personal passports (creator_id) are
  // always included — analytics on your own content needs no flag.
  // Platform admins bypass everything via callerHasFlag.
  const analyticsInstitutionIds: string[] = []
  for (const instId of institutionIds) {
    const ok = await callerHasFlag(supabase, instId, { flag: 'can_view_analytics' })
    if (ok) analyticsInstitutionIds.push(instId)
  }

  // Same ownership-OR as /api/dashboard and /program v1 — keeps the
  // three surfaces showing the same passport set. NOTE the
  // institution arm uses analyticsInstitutionIds (post-flag-filter),
  // not the raw institutionIds the caller belongs to.
  const ownedFilter = analyticsInstitutionIds.length > 0
    ? `creator_id.eq.${userId},proprietor_id.in.(${analyticsInstitutionIds.join(',')})`
    : `creator_id.eq.${userId}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: ownedRaw } = await db
    .from('passports')
    .select('id, title, status, is_published, published_at, proprietor_id, expected_spend_tier, updated_at, created_at')
    .or(ownedFilter)

  const owned = (ownedRaw ?? []) as OwnedPassportRow[]
  const ownedIds = owned.map((p) => p.id)
  const publishedIds = owned.filter((p) => p.is_published).map((p) => p.id)

  if (ownedIds.length === 0) {
    return emptyOverview()
  }

  // ── Time windows ───────────────────────────────────────────────
  const now = new Date()
  const thirtyAgo = new Date(now.getTime() - 30 * DAY_MS)
  const ninetyAgo = new Date(now.getTime() - 90 * DAY_MS)

  // ── Parallel fan-out ──────────────────────────────────────────
  // All count + completion-rate queries run in one round-trip group.
  const [
    pagesRes,
    stopsRes,
    acq90Res,
    acqAllRes,
    stamps30Res,
    stamps90Res,
    stampsCompletionRes,
    completionTokensRes,
    pagePrizeTextRes,
  ] = await Promise.all([
    db.from('passport_pages')
      .select('id, passport_id')
      .in('passport_id', ownedIds),
    // We need stops for the per-passport stop_count to compute
    // completion. stops live on pages; PostgREST can't join through
    // — fetch pages then stops by page id list. We do the join in
    // JS below, post-Promise.all.
    db.from('passport_pages')
      .select('id, passport_id')
      .in('passport_id', ownedIds),
    db.from('acquisitions')
      .select('passport_id, acquired_at')
      .in('passport_id', ownedIds)
      .gte('acquired_at', ninetyAgo.toISOString()),
    db.from('acquisitions')
      .select('passport_id, user_id, acquired_at')
      .in('passport_id', ownedIds),
    db.from('stamps')
      .select('passport_id, user_id')
      .in('passport_id', ownedIds)
      .gte('verified_at', thirtyAgo.toISOString()),
    db.from('stamps')
      .select('passport_id, user_id, verified_at')
      .in('passport_id', ownedIds)
      .gte('verified_at', ninetyAgo.toISOString()),
    // Full stamps history for completion-rate math — no time
    // window, because a collector who completed 6 months ago is
    // still complete today.
    db.from('stamps')
      .select('passport_id, user_id, stop_id')
      .in('passport_id', ownedIds),
    db.from('completion_tokens')
      .select('passport_id, prize_distributed, distribution_pending')
      .in('passport_id', ownedIds),
    db.from('passport_pages')
      .select('passport_id, prize_description')
      .in('passport_id', ownedIds),
  ])

  const pageList = (pagesRes.data ?? []) as { id: string; passport_id: string }[]
  const pageIds = pageList.map((p) => p.id)
  const pageToPassport = new Map(pageList.map((p) => [p.id, p.passport_id]))

  // Now that we have page ids, fetch stops to count required stop
  // coverage per passport. Runs sequentially after the Promise.all
  // because it depends on pageIds. Single round-trip — cost is
  // small compared with the parallel batch above.
  let stopsByPassport = new Map<string, Set<string>>()
  let totalStopsByPassport = new Map<string, number>()
  if (pageIds.length > 0) {
    const { data: stopRows } = await db
      .from('stops')
      .select('id, page_id')
      .in('page_id', pageIds)
    for (const s of ((stopRows ?? []) as { id: string; page_id: string }[])) {
      const pid = pageToPassport.get(s.page_id)
      if (!pid) continue
      let set = stopsByPassport.get(pid)
      if (!set) { set = new Set(); stopsByPassport.set(pid, set) }
      set.add(s.id)
    }
    stopsByPassport.forEach((set, pid) => {
      totalStopsByPassport.set(pid, set.size)
    })
  }
  void stopsRes // dedupe with pagesRes — kept the parallel slot for symmetry

  // ── KPI band ───────────────────────────────────────────────────
  const acq90 = (acq90Res.data ?? []) as { passport_id: string; acquired_at: string }[]
  const acqAll = (acqAllRes.data ?? []) as { passport_id: string; user_id: string; acquired_at: string }[]
  const stamps30 = (stamps30Res.data ?? []) as { passport_id: string; user_id: string }[]
  const stamps90 = (stamps90Res.data ?? []) as { passport_id: string; user_id: string; verified_at: string }[]
  const stampsAll = (stampsCompletionRes.data ?? []) as { passport_id: string; user_id: string; stop_id: string }[]
  const tokens = (completionTokensRes.data ?? []) as { passport_id: string; prize_distributed: boolean | null; distribution_pending: boolean | null }[]

  const activeCollectors30d = new Set(stamps30.map((s) => s.user_id)).size
  const acquisitions90d = acq90.length
  const stampsPlaced90d = stamps90.length
  const prizesHandedOut = tokens.filter((t) => t.prize_distributed === true).length
  const pendingDistribution = tokens.filter((t) => t.distribution_pending === true && t.prize_distributed !== true).length

  // ── Completion-rate math (cross-passport, institution-wide) ────
  // A (user_id × passport_id) pair counts as completing when the
  // pair's distinct stop_id set covers the passport's full stops
  // set. We count distinct ACQUIRERS as the denominator (a
  // collector who stamped without acquiring is uncommon but
  // possible — pre-monetization rows; we don't count them as
  // acquirers).
  const stampsByUserPassport = new Map<string, Set<string>>() // key: `${user_id}:${passport_id}`
  for (const s of stampsAll) {
    const key = `${s.user_id}:${s.passport_id}`
    let set = stampsByUserPassport.get(key)
    if (!set) { set = new Set(); stampsByUserPassport.set(key, set) }
    set.add(s.stop_id)
  }
  const acquirerKeys = new Set(acqAll.map((a) => `${a.user_id}:${a.passport_id}`))
  let completingCollectors = 0
  acquirerKeys.forEach((acqKey) => {
    const passportId = acqKey.split(':')[1]
    const required = totalStopsByPassport.get(passportId) ?? 0
    if (required === 0) return // can't complete a passport with no stops
    const stamped = stampsByUserPassport.get(acqKey)?.size ?? 0
    if (stamped >= required) completingCollectors++
  })
  const completionRatePct: number | null = acquirerKeys.size === 0
    ? null
    : Math.round((completingCollectors / acquirerKeys.size) * 100)

  // ── Per-passport rows ─────────────────────────────────────────
  const acqAllByPassport = bucketCount(acqAll, (a) => a.passport_id)
  const activeByPassport = bucketDistinct(stamps30, (s) => s.passport_id, (s) => s.user_id)
  const stampsPlacedByPassport = bucketCount(stamps90, (s) => s.passport_id)
  const lastStampByPassport = bucketLatest(stamps90, (s) => s.passport_id, (s) => s.verified_at)
  const lastAcqByPassport = bucketLatest(acqAll, (a) => a.passport_id, (a) => a.acquired_at)

  const perPassport: ProgramOverview['perPassport'] = owned.map((p) => {
    // per-passport completion: collectors who acquired this passport
    // AND stamped every stop on it.
    const passportAcquirerKeys = Array.from(acquirerKeys).filter((k) => k.endsWith(`:${p.id}`))
    const passportAcquirers = passportAcquirerKeys.length
    const required = totalStopsByPassport.get(p.id) ?? 0
    let passportCompleting = 0
    for (const k of passportAcquirerKeys) {
      const stamped = stampsByUserPassport.get(k)?.size ?? 0
      if (required > 0 && stamped >= required) passportCompleting++
    }
    const completionPct = passportAcquirers === 0
      ? null
      : Math.round((passportCompleting / passportAcquirers) * 100)
    const lastStamp = lastStampByPassport.get(p.id) ?? null
    const lastAcq = lastAcqByPassport.get(p.id) ?? null
    const lastActivity = pickLater(lastStamp, lastAcq)
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      isPublished: p.is_published,
      acquisitions: acqAllByPassport.get(p.id) ?? 0,
      activeCollectors30d: activeByPassport.get(p.id) ?? 0,
      stampsPlaced90d: stampsPlacedByPassport.get(p.id) ?? 0,
      completionPct,
      lastActivity,
    }
  })
  // Sort: published with activity first, then drafts.
  perPassport.sort((a, b) => {
    if (a.isPublished !== b.isPublished) return a.isPublished ? -1 : 1
    if (a.lastActivity && b.lastActivity) {
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    }
    if (a.lastActivity) return -1
    if (b.lastActivity) return 1
    return a.title.localeCompare(b.title)
  })

  // ── Trend ─────────────────────────────────────────────────────
  // 12 weekly buckets ending at now. Week boundaries are Mondays
  // in the server tz — the chart is a sparkline (no labels), so
  // boundary precision matters less than the shape.
  const trend = buildTrend(acqAll)

  // ── Needs Attention ───────────────────────────────────────────
  const attention: ProgramOverview['attention'] = []

  // (1) Drafts ≤2 blockers from publish — reuse the shared
  // publish-checklist so this surface and the main dashboard
  // disagree by ZERO. Cap at 5 to keep the panel scannable.
  const draftIds = owned.filter((p) => p.status !== 'published' && p.status !== 'archived').map((p) => p.id)
  if (draftIds.length > 0) {
    // Need stops per passport to run the checklist. We have
    // stopsByPassport, but with only ids, not the full PublishStop
    // shape. Fetch the slim columns the checklist needs.
    const { data: draftStops } = await db
      .from('stops')
      .select('page_id, experience_type, experience_verification_method, verification_tier, lat, lng, address_street, address_city, passport_pages!inner(passport_id)')
      .in('passport_pages.passport_id', draftIds)
    type JoinedStop = PublishStop & { page_id: string; passport_pages: { passport_id: string } | null }
    const stopsByPassportForCheck = new Map<string, PublishStop[]>()
    for (const s of ((draftStops ?? []) as JoinedStop[])) {
      const pid = s.passport_pages?.passport_id
      if (!pid) continue
      const arr = stopsByPassportForCheck.get(pid) ?? []
      arr.push(s)
      stopsByPassportForCheck.set(pid, arr)
    }
    const pagesByPassportCount = new Map<string, number>()
    for (const p of pageList) {
      pagesByPassportCount.set(p.passport_id, (pagesByPassportCount.get(p.passport_id) ?? 0) + 1)
    }
    const ranked: { passport: OwnedPassportRow; blockers: string[] }[] = []
    for (const p of owned) {
      if (!draftIds.includes(p.id)) continue
      const result = runPublishChecklist({
        passport: { title: p.title, proprietor_id: p.proprietor_id, expected_spend_tier: p.expected_spend_tier },
        pageCount: pagesByPassportCount.get(p.id) ?? 0,
        stops: stopsByPassportForCheck.get(p.id) ?? [],
        actorIsStudio: null,
      })
      if (result.blockers.length > 0 && result.blockers.length <= 2) {
        ranked.push({ passport: p, blockers: result.blockers })
      }
    }
    ranked.sort((a, b) => a.blockers.length - b.blockers.length)
    for (const r of ranked.slice(0, 5)) {
      attention.push({
        id: `near-publish-${r.passport.id}`,
        severity: 'info',
        title: `“${r.passport.title}” is ${r.blockers.length === 1 ? 'one step' : `${r.blockers.length} steps`} from publish`,
        meta: r.blockers[0],
        ctaLabel: 'Continue →',
        ctaHref: `/design/${r.passport.id}`,
      })
    }
  }

  // (2) Published ≥14 days with zero acquisitions.
  const acquiredPassportIds = new Set(acqAll.map((a) => a.passport_id))
  for (const p of owned) {
    if (!p.is_published || !p.published_at) continue
    const ageMs = now.getTime() - new Date(p.published_at).getTime()
    if (ageMs < ATTENTION_NO_ACQUISITIONS_DAYS * DAY_MS) continue
    if (acquiredPassportIds.has(p.id)) continue
    attention.push({
      id: `no-acq-${p.id}`,
      severity: 'warn',
      title: `“${p.title}” has no collectors yet`,
      meta: `Published ${Math.floor(ageMs / DAY_MS)} days ago`,
      ctaLabel: 'Open →',
      ctaHref: `/program?tab=passports&passport=${p.id}`,
    })
  }

  // (3) Published with NO prize text on any page. The publish gate
  // doesn't require prize text — it's optional — but absence is
  // worth flagging on a program surface where prizes are the
  // operator's lever.
  const passportsWithPrizeText = new Set<string>()
  for (const row of ((pagePrizeTextRes.data ?? []) as { passport_id: string; prize_description: string | null }[])) {
    if (row.prize_description?.trim()) passportsWithPrizeText.add(row.passport_id)
  }
  for (const p of owned) {
    if (!p.is_published) continue
    if (passportsWithPrizeText.has(p.id)) continue
    attention.push({
      id: `no-prize-${p.id}`,
      severity: 'info',
      title: `“${p.title}” has no prize text yet`,
      meta: 'Add it on any page’s Prize section in the designer',
      ctaLabel: 'Open →',
      ctaHref: `/design/${p.id}`,
    })
  }

  return {
    kpis: {
      activeCollectors30d,
      acquisitions90d,
      stampsPlaced90d,
      completionRatePct,
      prizesHandedOut,
      pendingDistribution,
    },
    perPassport,
    trend,
    attention,
    totals: {
      ownedPassports: owned.length,
      publishedPassports: publishedIds.length,
    },
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface OwnedPassportRow {
  id: string
  title: string
  status: string
  is_published: boolean
  published_at: string | null
  proprietor_id: string | null
  expected_spend_tier: string | null
  updated_at: string
  created_at: string
}

function emptyOverview(): ProgramOverview {
  return {
    kpis: {
      activeCollectors30d: 0,
      acquisitions90d: 0,
      stampsPlaced90d: 0,
      completionRatePct: null,
      prizesHandedOut: 0,
      pendingDistribution: 0,
    },
    perPassport: [],
    trend: { weeklyAcquisitions: new Array(TREND_WEEKS).fill(0), weekStartIsos: [], firstAcquisitionAt: null },
    attention: [],
    totals: { ownedPassports: 0, publishedPassports: 0 },
  }
}

function bucketCount<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

function bucketDistinct<T>(rows: T[], key: (r: T) => string, val: (r: T) => string): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const r of rows) {
    const k = key(r)
    let s = sets.get(k)
    if (!s) { s = new Set(); sets.set(k, s) }
    s.add(val(r))
  }
  const out = new Map<string, number>()
  sets.forEach((s, k) => { out.set(k, s.size) })
  return out
}

function bucketLatest<T>(rows: T[], key: (r: T) => string, time: (r: T) => string): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of rows) {
    const k = key(r)
    const t = time(r)
    const prev = out.get(k)
    if (!prev || new Date(t).getTime() > new Date(prev).getTime()) {
      out.set(k, t)
    }
  }
  return out
}

function pickLater(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

function buildTrend(acqAll: { passport_id: string; acquired_at: string }[]): ProgramOverview['trend'] {
  const now = Date.now()
  // Week buckets indexed [oldest..newest]. Start each bucket at
  // the SAME day-of-week as now to keep boundaries stable across
  // refreshes within a day.
  const buckets = new Array(TREND_WEEKS).fill(0) as number[]
  const weekStartIsos: string[] = []
  for (let i = 0; i < TREND_WEEKS; i++) {
    const start = now - (TREND_WEEKS - i) * WEEK_MS
    weekStartIsos.push(new Date(start).toISOString())
  }
  let firstAcquisitionAt: string | null = null
  for (const a of acqAll) {
    const ts = new Date(a.acquired_at).getTime()
    if (!firstAcquisitionAt || ts < new Date(firstAcquisitionAt).getTime()) {
      firstAcquisitionAt = a.acquired_at
    }
    const ageMs = now - ts
    if (ageMs < 0 || ageMs > TREND_WEEKS * WEEK_MS) continue
    const weekIdx = TREND_WEEKS - 1 - Math.floor(ageMs / WEEK_MS)
    if (weekIdx >= 0 && weekIdx < TREND_WEEKS) buckets[weekIdx]++
  }
  return { weeklyAcquisitions: buckets, weekStartIsos, firstAcquisitionAt }
}
