import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  Passport,
  PassportPage,
  Stop,
  Stamp,
  MoodRating,
  CompletionToken,
  Profile,
  EmployeeAuthorization,
} from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
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

// Partial row shapes returned by the Supabase .select() projections used below.
type PassportRow = Pick<Passport, 'id' | 'proprietor_id'>
type PageRow = Pick<PassportPage, 'id'>
type StopRow = Pick<Stop, 'id' | 'name' | 'page_id'>
type ProfileIdRow = Pick<Profile, 'id'>
type StampRow = Pick<Stamp, 'id' | 'stop_id' | 'user_id'>
type MoodRow = Pick<MoodRating, 'stamp_id' | 'rating'>
type TokenRow = Pick<
  CompletionToken,
  'id' | 'page_id' | 'redeemed_at' | 'prize_distributed' | 'distribution_pending'
>
type AuthzRow = Pick<EmployeeAuthorization, 'id' | 'can_view_analytics'>

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { passportId: string } },
): Promise<NextResponse> {
  const { passportId } = params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up passport and its proprietor
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, proprietor_id')
    .eq('id', passportId)
    .single<PassportRow>()

  if (passportError || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  if (!passport.proprietor_id) {
    return NextResponse.json(
      { error: 'Passport has no proprietor institution' },
      { status: 422 },
    )
  }

  // Verify the requesting user has employee_authorization for
  // this institution AND that they hold can_view_analytics. The
  // flag was schema-only until /access wiring (BLD-03 enforcement);
  // this is where it grows teeth.
  const { data: authorization, error: authzError } = await supabase
    .from('employee_authorizations')
    .select('id, can_view_analytics')
    .eq('user_id', user.id)
    .eq('institution_id', passport.proprietor_id)
    .single<AuthzRow>()

  if (authzError || !authorization) {
    return NextResponse.json(
      { error: 'Not authorized to view analytics for this passport' },
      { status: 403 },
    )
  }
  if (authorization.can_view_analytics !== true) {
    return NextResponse.json(
      { error: 'can_view_analytics required' },
      { status: 403 },
    )
  }

  // -------------------------------------------------------------------------
  // Stop-level engagement
  // -------------------------------------------------------------------------

  // Fetch all pages for this passport
  const { data: pages, error: pagesError } = await supabase
    .from('passport_pages')
    .select('id')
    .eq('passport_id', passportId)
    .returns<PageRow[]>()

  if (pagesError) {
    console.error('[analytics] pages fetch error:', pagesError)
    return NextResponse.json({ error: 'Failed to fetch passport pages' }, { status: 500 })
  }

  const pageRows: PageRow[] = pages ?? []
  const pageIds: string[] = pageRows.map((p: PageRow) => p.id)

  const { data: stops, error: stopsError } = await supabase
    .from('stops')
    .select('id, name, page_id')
    .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])
    .returns<StopRow[]>()

  if (stopsError) {
    console.error('[analytics] stops fetch error:', stopsError)
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 })
  }

  const stopList: StopRow[] = stops ?? []
  const stopIds: string[] = stopList.map((s: StopRow) => s.id)

  // Fetch stamps for this passport, excluding users under 13.
  // Under-13 check: date_of_birth within 13 years of today.
  const thirteenYearsAgo = new Date()
  thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13)
  const cutoffDate = thirteenYearsAgo.toISOString().slice(0, 10) // YYYY-MM-DD

  // Fetch profiles that are under 13 so we can exclude them
  const { data: under13Profiles } = await supabase
    .from('profiles')
    .select('id')
    .not('date_of_birth', 'is', null)
    .gt('date_of_birth', cutoffDate)
    .returns<ProfileIdRow[]>()

  const under13Rows: ProfileIdRow[] = under13Profiles ?? []
  const under13Ids: string[] = under13Rows.map((p: ProfileIdRow) => p.id)

  let stampsQuery = supabase
    .from('stamps')
    .select('id, stop_id, user_id')
    .eq('passport_id', passportId)
    .in('stop_id', stopIds.length > 0 ? stopIds : ['__none__'])
    .returns<StampRow[]>()

  if (under13Ids.length > 0) {
    stampsQuery = stampsQuery.not('user_id', 'in', `(${under13Ids.join(',')})`)
  }

  const { data: stamps, error: stampsError } = await stampsQuery

  if (stampsError) {
    console.error('[analytics] stamps fetch error:', stampsError)
    return NextResponse.json({ error: 'Failed to fetch stamps' }, { status: 500 })
  }

  const stampList: StampRow[] = stamps ?? []
  const stampIds: string[] = stampList.map((s: StampRow) => s.id)

  // Mood ratings for these stamps
  const { data: moodRatings } = await supabase
    .from('mood_ratings')
    .select('stamp_id, rating')
    .in('stamp_id', stampIds.length > 0 ? stampIds : ['__none__'])
    .returns<MoodRow[]>()

  const moodList: MoodRow[] = moodRatings ?? []

  // Build per-stop stamp counts
  const stampsByStop = new Map<string, { userIds: Set<string>; stampIds: string[] }>()
  for (const stamp of stampList) {
    if (!stampsByStop.has(stamp.stop_id)) {
      stampsByStop.set(stamp.stop_id, { userIds: new Set(), stampIds: [] })
    }
    const entry = stampsByStop.get(stamp.stop_id)!
    entry.userIds.add(stamp.user_id)
    entry.stampIds.push(stamp.id)
  }

  // Build per-stop mood averages (via stamp_id → stop_id lookup)
  const stampToStop = new Map<string, string>()
  for (const stamp of stampList) {
    stampToStop.set(stamp.id, stamp.stop_id)
  }

  const moodsByStop = new Map<string, number[]>()
  for (const mood of moodList) {
    const stopId = stampToStop.get(mood.stamp_id)
    if (!stopId) continue
    if (!moodsByStop.has(stopId)) moodsByStop.set(stopId, [])
    moodsByStop.get(stopId)!.push(mood.rating)
  }

  // Presence sessions: we approximate return-visit rate by counting users
  // who appear in stamps more than once for a given stop (since presence_sessions
  // is not in the current type schema, we use repeated user stamps as a proxy).
  // Return visit rate = users with >1 stamp on the stop / total distinct users on the stop.
  const stopEngagement: StopEngagement[] = stopList.map((stop: StopRow) => {
    const entry = stampsByStop.get(stop.id)
    const stampCount = entry ? entry.stampIds.length : 0

    const moodValues = moodsByStop.get(stop.id) ?? []
    const avgMoodRating =
      moodValues.length > 0
        ? moodValues.reduce((sum: number, r: number) => sum + r, 0) / moodValues.length
        : null

    // Return-visit rate proxy: users with more than one stamp / total unique users
    let returnVisitRate: number | null = null
    if (entry && entry.userIds.size > 0) {
      // Count per-user stamp frequency
      const userStampCount = new Map<string, number>()
      for (const stampId of entry.stampIds) {
        const found = stampList.find((s: StampRow) => s.id === stampId)
        if (!found) continue
        userStampCount.set(found.user_id, (userStampCount.get(found.user_id) ?? 0) + 1)
      }
      const returners = [...userStampCount.values()].filter((c: number) => c > 1).length
      returnVisitRate = returners / entry.userIds.size
    }

    return {
      stopId: stop.id,
      stopName: stop.name,
      stampCount,
      avgMoodRating,
      // avgPresenceDurationSeconds: not available without a presence_sessions table
      avgPresenceDurationSeconds: null,
      returnVisitRate,
    }
  })

  // -------------------------------------------------------------------------
  // Completion token status breakdown per page
  // -------------------------------------------------------------------------

  const { data: tokens, error: tokensError } = await supabase
    .from('completion_tokens')
    .select('id, page_id, redeemed_at, prize_distributed, distribution_pending')
    .eq('passport_id', passportId)
    .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])
    .returns<TokenRow[]>()

  if (tokensError) {
    console.error('[analytics] tokens fetch error:', tokensError)
    return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
  }

  const tokenList: TokenRow[] = tokens ?? []

  const tokensByPage = new Map<
    string,
    { total: number; redeemed: number; distributed: number; pending: number }
  >()

  for (const token of tokenList) {
    if (!tokensByPage.has(token.page_id)) {
      tokensByPage.set(token.page_id, { total: 0, redeemed: 0, distributed: 0, pending: 0 })
    }
    const counts = tokensByPage.get(token.page_id)!
    counts.total += 1
    if (token.redeemed_at !== null) counts.redeemed += 1
    if (token.prize_distributed === true) counts.distributed += 1
    if (token.distribution_pending === true) counts.pending += 1
  }

  const tokenStatus: TokenStatusBreakdown[] = pageIds.map((pageId: string) => {
    const counts = tokensByPage.get(pageId) ?? {
      total: 0,
      redeemed: 0,
      distributed: 0,
      pending: 0,
    }
    return { pageId, ...counts }
  })

  // -------------------------------------------------------------------------
  // Distribution-pending count (across all pages)
  // -------------------------------------------------------------------------

  const distributionPendingCount = tokenList.filter(
    (t: TokenRow) => t.distribution_pending === true && t.prize_distributed !== true,
  ).length

  const response: AnalyticsResponse = {
    passportId,
    stopEngagement,
    tokenStatus,
    distributionPendingCount,
  }

  return NextResponse.json(response)
}
