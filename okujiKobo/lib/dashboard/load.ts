/**
 * Batched dashboard loader — fetches the entire post-login dashboard
 * payload in one server call.
 *
 * Used by:
 *   - app/page.tsx       (server component, direct SSR call — zero
 *                         client round-trips)
 *   - app/api/dashboard  (JSON endpoint, returns the same payload for
 *                         any client refresh path)
 *
 * Design rules:
 *   - EVERY visible number comes from a real query. Dormant slots
 *     (see lib/dashboard/flags.ts) are NOT computed here.
 *   - All queries fan out in Promise.all so the round-trip count to
 *     the database is bounded, not proportional to the number of
 *     panels.
 *   - Scope = passports the actor owns: either creator_id = user.id
 *     OR proprietor_id IN (institutions they manage). After
 *     ownership transfer the creator_id is a custodial account, so
 *     proprietor_id is the durable institutional link.
 */

import { detectRoles, type RoleContext } from '@/lib/roles'
import { runPublishChecklist, stopLocationIssue, type PublishStop } from '@/lib/design/publish-checklist'

// The dashboard loader accepts any Supabase client variant; the
// generated Database typings don't cover every table the dashboard
// touches (stamps, acquisitions, transfers come from migrations
// not yet reflected in lib/supabase/types.ts), so we widen here
// and rely on RLS for actual safety. Use `db` (any) below for
// from() calls — same pattern the existing app pages follow.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

// ── Public payload shape ─────────────────────────────────────────────────────

export interface DashboardKpi {
  label: string
  value: number | string
  delta?: { sign: 'up' | 'down' | 'flat'; text: string }
}

export interface DashboardAttentionItem {
  id: string
  severity: 'info' | 'warn' | 'error'
  title: string
  meta: string
  ctaLabel: string
  ctaHref: string
}

export interface DashboardActivityItem {
  id: string
  ts: string                 // ISO
  kind: 'acquire' | 'stamp' | 'publish'
  label: string
  sub: string
}

export interface DashboardAudit {
  /** GPS-method stops on published owned passports missing lat or lng. */
  gpsMissingCoords: number
  /** QR-method stops on published owned passports missing street and city. */
  qrMissingAddress: number
  /** Number of distinct published passports affected. */
  affectedPassports: number
}

export interface DashboardData {
  userId: string
  displayName: string | null
  firstName: string | null
  generatedAt: string
  /** Counts for the KPI row — VISIBLE only. */
  kpis: {
    published:       DashboardKpi
    acquired90d:     DashboardKpi
    activeCollectors: DashboardKpi
  }
  audit: DashboardAudit
  attention: DashboardAttentionItem[]
  activity: DashboardActivityItem[]
}

// ── Loader ───────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

export async function loadDashboard(
  supabase: AnySupabase,
  userId: string,
): Promise<DashboardData> {
  // Detect roles + institution memberships once. Used for scoping and
  // for incoming-transfer audience matching.
  const roleContext = await detectRoles(supabase, userId)
  const institutionIds = roleContext.institutions.map((i) => i.id)

  // Profile + ownership map can run in parallel.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const profileP = db
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()

  // Owned passports — single query with an OR. This is the keystone
  // join: every other panel filters by these ids.
  const ownedFilter = institutionIds.length > 0
    ? `creator_id.eq.${userId},proprietor_id.in.(${institutionIds.join(',')})`
    : `creator_id.eq.${userId}`

  const ownedP = db
    .from('passports')
    .select('id, title, status, is_published, published_at, price_cents, expected_spend_tier, proprietor_id, creator_id, updated_at, created_at')
    .or(ownedFilter)

  const [profileRes, ownedRes] = await Promise.all([profileP, ownedP])

  const profile = profileRes.data as { display_name: string | null } | null
  const owned = (ownedRes.data ?? []) as OwnedPassportRow[]
  const ownedIds = owned.map((p) => p.id)
  const publishedIds = owned.filter((p) => p.is_published).map((p) => p.id)
  const draftIds = owned.filter((p) => p.status !== 'published' && p.status !== 'archived').map((p) => p.id)

  // Time windows.
  const now = new Date()
  const ninetyAgo = new Date(now.getTime() - 90 * DAY_MS)
  const oneEightyAgo = new Date(now.getTime() - 180 * DAY_MS)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Activity-feed cutoff: 90 days is generous for the 10 most-recent
  // sort that follows. Bounded so a quiet account doesn't trawl years
  // of stamps.
  const activityCutoff = new Date(now.getTime() - 90 * DAY_MS).toISOString()

  // ── Parallel fan-out ────────────────────────────────────────────
  // Every query below is scoped to ownedIds (or skipped entirely if
  // the user owns nothing yet). One round-trip group, no waterfalls.

  const noOwned = ownedIds.length === 0

  const [
    acq90Res,
    acqPriorRes,
    auditPagesRes,
    transfersInRes,
    transfersOutRes,
    draftPagesRes,
    draftStopsRes,
    actAcqRes,
    actStampRes,
  ] = await Promise.all([
    noOwned ? Promise.resolve({ data: [] }) : db.from('acquisitions').select('user_id, acquired_at').in('passport_id', ownedIds).gte('acquired_at', ninetyAgo.toISOString()),
    noOwned ? Promise.resolve({ data: [] }) : db.from('acquisitions').select('id').in('passport_id', ownedIds).gte('acquired_at', oneEightyAgo.toISOString()).lt('acquired_at', ninetyAgo.toISOString()),
    publishedIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('passport_pages').select('id, passport_id').in('passport_id', publishedIds),
    db.from('passport_transfers')
      .select('id, passport_id, to_user_id, to_institution_id, initiated_by, initiated_at, status')
      .eq('status', 'pending'),
    db.from('passport_transfers')
      .select('id, passport_id, to_user_id, to_institution_id, status, initiated_at')
      .eq('status', 'pending')
      .eq('initiated_by', userId),
    draftIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('passport_pages').select('id, passport_id').in('passport_id', draftIds),
    draftIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('stops').select('page_id, experience_type, experience_verification_method, verification_tier, lat, lng, address_street, address_city, passport_pages!inner(passport_id)').in('passport_pages.passport_id', draftIds),
    noOwned ? Promise.resolve({ data: [] }) : db.from('acquisitions')
      .select('id, passport_id, acquired_at')
      .in('passport_id', ownedIds)
      .gte('acquired_at', activityCutoff)
      .order('acquired_at', { ascending: false })
      .limit(8),
    noOwned ? Promise.resolve({ data: [] }) : db.from('stamps')
      .select('id, passport_id, stop_id, verified_at')
      .in('passport_id', ownedIds)
      .gte('verified_at', activityCutoff)
      .order('verified_at', { ascending: false })
      .limit(8),
  ])

  // ── KPIs ────────────────────────────────────────────────────────

  const publishedCount = publishedIds.length
  const publishedThisMonth = owned.filter(
    (p) => p.is_published && p.published_at && new Date(p.published_at) >= monthStart,
  ).length

  const acq90 = (acq90Res.data ?? []) as { user_id: string; acquired_at: string }[]
  const acqPrior = (acqPriorRes.data ?? []) as { id: string }[]
  const acq90Count = acq90.length
  const acqPriorCount = acqPrior.length
  // Active collectors = distinct user_id who acquired in the last 90d
  // (an "active library holder", not a stamper). This matches the
  // PASSPORT-level view of "how many people are carrying my stuff"
  // and avoids needing to merge into stamps to get a number.
  const activeCollectors = new Set(acq90.map((r) => r.user_id)).size

  const kpis = {
    published: {
      label: 'Published',
      value: publishedCount,
      delta: publishedThisMonth > 0
        ? { sign: 'up' as const, text: `↑ ${publishedThisMonth} this mo` }
        : undefined,
    },
    acquired90d: {
      label: 'Acquired · 90d',
      value: acq90Count,
      delta: deltaPercent(acq90Count, acqPriorCount),
    },
    activeCollectors: {
      label: 'Active collectors',
      value: activeCollectors,
      // Growth delta intentionally omitted — would need a second
      // pass against the prior window's distinct set; not cheap.
      // See DASHBOARD_REVIEW.md (review item 3).
    },
  }

  // ── Audit ───────────────────────────────────────────────────────

  let gpsMissing = 0
  let qrMissing = 0
  const affected = new Set<string>()

  if (publishedIds.length > 0) {
    const pageList = (auditPagesRes.data ?? []) as { id: string; passport_id: string }[]
    const pageToPassport = new Map(pageList.map((p) => [p.id, p.passport_id]))
    const pageIds = pageList.map((p) => p.id)

    if (pageIds.length > 0) {
      const { data: stopRows } = await db
        .from('stops')
        .select('page_id, experience_type, experience_verification_method, verification_tier, lat, lng, address_street, address_city')
        .in('page_id', pageIds)

      const stops = (stopRows ?? []) as Array<PublishStop & { page_id: string }>
      for (const s of stops) {
        const issue = stopLocationIssue(s)
        if (issue === 'coords') {
          gpsMissing++
          const pid = pageToPassport.get(s.page_id)
          if (pid) affected.add(pid)
        } else if (issue === 'address') {
          qrMissing++
          const pid = pageToPassport.get(s.page_id)
          if (pid) affected.add(pid)
        }
      }
    }
  }

  const audit: DashboardAudit = {
    gpsMissingCoords: gpsMissing,
    qrMissingAddress: qrMissing,
    affectedPassports: affected.size,
  }

  // ── Attention queue ────────────────────────────────────────────

  const attention: DashboardAttentionItem[] = []

  // 1) Near-publish drafts: run the shared checklist; surface those
  //    with ≤2 blockers. Cap to 5 so the queue stays scannable.
  if (draftIds.length > 0) {
    const draftPages = (draftPagesRes.data ?? []) as { id: string; passport_id: string }[]
    const pagesByPassport = new Map<string, number>()
    const pageIdToPassport = new Map<string, string>()
    for (const p of draftPages) {
      pagesByPassport.set(p.passport_id, (pagesByPassport.get(p.passport_id) ?? 0) + 1)
      pageIdToPassport.set(p.id, p.passport_id)
    }

    // draftStopsRes joined via passport_pages!inner(passport_id) — the
    // joined column comes back nested; pull it out.
    type JoinedStop = PublishStop & {
      page_id: string
      passport_pages: { passport_id: string } | null
    }
    const draftStops = (draftStopsRes.data ?? []) as JoinedStop[]
    const stopsByPassport = new Map<string, PublishStop[]>()
    for (const s of draftStops) {
      const pid = s.passport_pages?.passport_id ?? pageIdToPassport.get(s.page_id)
      if (!pid) continue
      const arr = stopsByPassport.get(pid) ?? []
      arr.push(s)
      stopsByPassport.set(pid, arr)
    }

    const draftPassports = owned.filter((p) => draftIds.includes(p.id))
    const ranked: { passport: OwnedPassportRow; blockers: string[] }[] = []
    for (const p of draftPassports) {
      const result = runPublishChecklist({
        passport: { title: p.title, proprietor_id: p.proprietor_id, expected_spend_tier: p.expected_spend_tier },
        pageCount: pagesByPassport.get(p.id) ?? 0,
        stops: stopsByPassport.get(p.id) ?? [],
        // Skip the Studio gate at dashboard time — actor's
        // subscription state isn't fetched here; PublishFlow will
        // re-check when they actually try to publish.
        actorIsStudio: null,
      })
      if (result.blockers.length > 0 && result.blockers.length <= 2) {
        ranked.push({ passport: p, blockers: result.blockers })
      }
    }
    // Show the closest-to-done first.
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

  // 2) Transfer offers awaiting THIS user's acceptance.
  type TransferRow = {
    id: string
    passport_id: string
    to_user_id: string | null
    to_institution_id: string | null
    initiated_by: string
    initiated_at: string
    status: string
  }
  const transfersIn = (transfersInRes.data ?? []) as TransferRow[]
  const incomingForMe = transfersIn.filter(
    (t) =>
      t.initiated_by !== userId
      && (t.to_user_id === userId || (t.to_institution_id && institutionIds.includes(t.to_institution_id))),
  )

  if (incomingForMe.length > 0) {
    // Title lookup for the affected passports — could be from rows we
    // don't own yet (incoming offers reference passports the offerer
    // owns), so do a small fetch.
    const incomingPassportIds = incomingForMe.map((t) => t.passport_id)
    const { data: incomingPassports } = await db
      .from('passports')
      .select('id, title')
      .in('id', incomingPassportIds)
    const titleMap = new Map(
      ((incomingPassports ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]),
    )

    for (const t of incomingForMe.slice(0, 5)) {
      const title = titleMap.get(t.passport_id) ?? 'a passport'
      attention.push({
        id: `transfer-in-${t.id}`,
        severity: 'info',
        title: `You’ve been offered “${title}”`,
        meta: 'Pending your acceptance',
        ctaLabel: 'Accept →',
        ctaHref: `/transfers`,
      })
    }
  }

  // 3) Outgoing transfers the user initiated, still pending.
  const transfersOut = (transfersOutRes.data ?? []) as TransferRow[]
  if (transfersOut.length > 0) {
    const outgoingPassportIds = transfersOut.map((t) => t.passport_id)
    const { data: outgoingPassports } = await db
      .from('passports')
      .select('id, title')
      .in('id', outgoingPassportIds)
    const titleMap = new Map(
      ((outgoingPassports ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]),
    )
    for (const t of transfersOut.slice(0, 5)) {
      const title = titleMap.get(t.passport_id) ?? 'a passport'
      attention.push({
        id: `transfer-out-${t.id}`,
        severity: 'info',
        title: `“${title}” awaiting acceptance`,
        meta: t.to_institution_id ? 'Pending recipient institution' : 'Pending recipient user',
        ctaLabel: 'View →',
        ctaHref: `/transfers`,
      })
    }
  }

  // 4) Coordinate-audit summary row (same data as hero).
  if (audit.gpsMissingCoords > 0 || audit.qrMissingAddress > 0) {
    const total = audit.gpsMissingCoords + audit.qrMissingAddress
    attention.push({
      id: 'audit-summary',
      severity: 'error',
      title: `${total} stop${total === 1 ? '' : 's'} need location data`,
      meta: `Across ${audit.affectedPassports} published passport${audit.affectedPassports === 1 ? '' : 's'}`,
      ctaLabel: 'Review →',
      ctaHref: '/dashboard/audit',
    })
  }

  // ── Activity feed ──────────────────────────────────────────────

  type RawActivity = DashboardActivityItem
  const activity: RawActivity[] = []

  type AcqRow = { id: string; passport_id: string; acquired_at: string }
  type StampRow = { id: string; passport_id: string; stop_id: string; verified_at: string }

  const acqRows = (actAcqRes.data ?? []) as AcqRow[]
  const stampRows = (actStampRes.data ?? []) as StampRow[]
  const titleById = new Map(owned.map((p) => [p.id, p.title]))

  // Stops referenced by stamp events — fetch names for the sub-line.
  const stopIds = Array.from(new Set(stampRows.map((s) => s.stop_id))).slice(0, 50)
  const stopNames = new Map<string, string>()
  if (stopIds.length > 0) {
    const { data: stopName } = await db
      .from('stops')
      .select('id, name')
      .in('id', stopIds)
    for (const s of (stopName ?? []) as { id: string; name: string }[]) {
      stopNames.set(s.id, s.name)
    }
  }

  for (const a of acqRows) {
    activity.push({
      id: `acq-${a.id}`,
      ts: a.acquired_at,
      kind: 'acquire',
      label: 'Collector joined',
      sub: titleById.get(a.passport_id) ?? 'a passport',
    })
  }
  for (const s of stampRows) {
    activity.push({
      id: `stamp-${s.id}`,
      ts: s.verified_at,
      kind: 'stamp',
      label: stopNames.get(s.stop_id) ?? 'Stamp earned',
      sub: titleById.get(s.passport_id) ?? 'a passport',
    })
  }
  // Publish events derived from owned passports' published_at column
  // (real timestamp; migration adds it). No separate audit table.
  for (const p of owned) {
    if (p.is_published && p.published_at && new Date(p.published_at) >= new Date(activityCutoff)) {
      activity.push({
        id: `pub-${p.id}`,
        ts: p.published_at,
        kind: 'publish',
        label: 'Passport published',
        sub: p.title,
      })
    }
  }

  activity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  const trimmedActivity = activity.slice(0, 10)

  // ── Display name → first word for greeting ─────────────────────
  const displayName = profile?.display_name ?? null
  const firstName = displayName ? displayName.split(/\s+/)[0] : null

  return {
    userId,
    displayName,
    firstName,
    generatedAt: now.toISOString(),
    kpis,
    audit,
    attention,
    activity: trimmedActivity,
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

interface OwnedPassportRow {
  id: string
  title: string
  status: string
  is_published: boolean
  published_at: string | null
  price_cents: number | null
  expected_spend_tier: string | null
  proprietor_id: string | null
  creator_id: string
  updated_at: string
  created_at: string
}

function deltaPercent(curr: number, prev: number): DashboardKpi['delta'] {
  if (prev === 0 && curr === 0) return undefined
  if (prev === 0) return { sign: 'up', text: `↑ first 90d` }
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct === 0) return { sign: 'flat', text: '— vs prior 90d' }
  return {
    sign: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs prior 90d`,
  }
}

// Re-export for the role context type used by callers.
export type { RoleContext }
