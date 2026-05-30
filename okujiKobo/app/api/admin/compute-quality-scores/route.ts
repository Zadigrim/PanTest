import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import type {
  Database,
  Passport,
  PassportPage,
  Stop,
  Acquisition,
  Stamp,
  MoodRating,
  Profile,
  CreatorQualityScore,
} from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS for admin bulk reads/writes)
// ---------------------------------------------------------------------------

function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  )
}

// ---------------------------------------------------------------------------
// Partial row shapes returned by Supabase .select() projections
// ---------------------------------------------------------------------------

type PassportRow = Pick<Passport, 'id' | 'passport_type'>
type PageRow = Pick<PassportPage, 'id' | 'passport_id'>
type StopRow = Pick<Stop, 'id' | 'page_id'>
type AcquisitionRow = Pick<Acquisition, 'id' | 'user_id' | 'passport_id'>
type StampRow = Pick<Stamp, 'id' | 'user_id' | 'passport_id' | 'stop_id' | 'verifier_id'>
type MoodRow = Pick<MoodRating, 'stamp_id' | 'rating'>
type ProfileIdRow = Pick<Profile, 'id'>

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface ScoreResult {
  passportId: string
  completionRate: number
  avgMoodRating: number | null
  returnVisitRate: number
  expertSignoffRate: number
  compositeScore: number
}

interface ComputeResponse {
  computed: number
  scores: ScoreResult[]
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(_request: NextRequest): Promise<NextResponse> {
  // Auth check using session-aware client
  const sessionClient = await createClient()
  const {
    data: { user },
    error: authError,
  } = await sessionClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Confirm platform admin via the canonical RPC. The previous check on
  // profiles.role === 'admin' was the legacy mobile-schema role string,
  // which no code path writes; real platform admins have
  // profiles.is_platform_admin = true and profiles.role = 'collector' by
  // default. The old check refused real admins.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (sessionClient as any).rpc('is_platform_admin')
  if (!isAdminRpc) {
    return NextResponse.json({ error: 'Forbidden: platform admin required' }, { status: 403 })
  }

  // Use service-role client for bulk data access
  const supabase = createServiceClient()

  // -------------------------------------------------------------------------
  // Fetch all published passports
  // -------------------------------------------------------------------------

  const { data: passports, error: passportsError } = await supabase
    .from('passports')
    .select('id, passport_type')
    .eq('is_published', true)
    .returns<PassportRow[]>()

  if (passportsError) {
    console.error('[compute-quality-scores] passports fetch error:', passportsError)
    return NextResponse.json({ error: 'Failed to fetch passports' }, { status: 500 })
  }

  const passportRows: PassportRow[] = passports ?? []

  if (passportRows.length === 0) {
    return NextResponse.json({ computed: 0, scores: [] } satisfies ComputeResponse)
  }

  // -------------------------------------------------------------------------
  // Under-13 exclusion list
  // -------------------------------------------------------------------------

  const thirteenYearsAgo = new Date()
  thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13)
  const cutoffDate = thirteenYearsAgo.toISOString().slice(0, 10)

  const { data: under13Profiles } = await supabase
    .from('profiles')
    .select('id')
    .not('date_of_birth', 'is', null)
    .gt('date_of_birth', cutoffDate)
    .returns<ProfileIdRow[]>()

  const under13Rows: ProfileIdRow[] = under13Profiles ?? []
  const under13Ids = new Set<string>(under13Rows.map((p: ProfileIdRow) => p.id))

  // -------------------------------------------------------------------------
  // Fetch bulk data once (avoid N+1 per passport)
  // -------------------------------------------------------------------------

  const passportIds: string[] = passportRows.map((p: PassportRow) => p.id)

  // All acquisitions for these passports
  const { data: allAcquisitions } = await supabase
    .from('acquisitions')
    .select('id, user_id, passport_id')
    .in('passport_id', passportIds)
    .returns<AcquisitionRow[]>()

  const acquisitionList: AcquisitionRow[] = allAcquisitions ?? []

  // All pages to map page_id → passport_id
  const { data: allPages } = await supabase
    .from('passport_pages')
    .select('id, passport_id')
    .in('passport_id', passportIds)
    .returns<PageRow[]>()

  const pageRows: PageRow[] = allPages ?? []

  const pageToPassport = new Map<string, string>()
  const stopsByPassport = new Map<string, string[]>()

  for (const page of pageRows) {
    pageToPassport.set(page.id, page.passport_id)
  }

  const allPageIds: string[] = pageRows.map((p: PageRow) => p.id)

  const { data: allStops } = await supabase
    .from('stops')
    .select('id, page_id')
    .in('page_id', allPageIds.length > 0 ? allPageIds : ['__none__'])
    .returns<StopRow[]>()

  const stopRows: StopRow[] = allStops ?? []

  for (const stop of stopRows) {
    const pid = pageToPassport.get(stop.page_id)
    if (!pid) continue
    if (!stopsByPassport.has(pid)) stopsByPassport.set(pid, [])
    stopsByPassport.get(pid)!.push(stop.id)
  }

  // All stamps (excluding under-13 users)
  let stampsQuery = supabase
    .from('stamps')
    .select('id, user_id, passport_id, stop_id, verifier_id')
    .in('passport_id', passportIds)
    .returns<StampRow[]>()

  if (under13Ids.size > 0) {
    stampsQuery = stampsQuery.not('user_id', 'in', `(${[...under13Ids].join(',')})`)
  }

  const { data: allStamps } = await stampsQuery
  const stampList: StampRow[] = allStamps ?? []

  // All mood ratings for these stamps
  const allStampIds: string[] = stampList.map((s: StampRow) => s.id)

  const { data: allMoodRatings } = await supabase
    .from('mood_ratings')
    .select('stamp_id, rating')
    .in('stamp_id', allStampIds.length > 0 ? allStampIds : ['__none__'])
    .returns<MoodRow[]>()

  const moodList: MoodRow[] = allMoodRatings ?? []

  // -------------------------------------------------------------------------
  // Compute per-passport scores
  // -------------------------------------------------------------------------

  const scores: ScoreResult[] = []

  for (const passport of passportRows) {
    const pid = passport.id
    const isLearning = passport.passport_type === 'learning'

    // Acquisitions for this passport
    const acquisitions = acquisitionList.filter((a: AcquisitionRow) => a.passport_id === pid)
    const totalAcquired = acquisitions.length

    // Stops for this passport
    const stopIdsForPassport: string[] = stopsByPassport.get(pid) ?? []
    const totalStops = stopIdsForPassport.length

    // Stamps for this passport
    const stampsForPassport = stampList.filter((s: StampRow) => s.passport_id === pid)

    // -----------------------------------------------------------------------
    // completion_rate: distinct users who stamped ALL stops / total acquisitions
    // -----------------------------------------------------------------------
    let completionRate = 0
    if (totalAcquired > 0 && totalStops > 0) {
      const stampedStopsByUser = new Map<string, Set<string>>()
      for (const stamp of stampsForPassport) {
        if (!stampedStopsByUser.has(stamp.user_id)) {
          stampedStopsByUser.set(stamp.user_id, new Set())
        }
        stampedStopsByUser.get(stamp.user_id)!.add(stamp.stop_id)
      }
      let completedCount = 0
      for (const [, stopsVisited] of stampedStopsByUser) {
        if (stopsVisited.size >= totalStops) completedCount += 1
      }
      completionRate = completedCount / totalAcquired
    }

    // -----------------------------------------------------------------------
    // avg_mood_rating: avg of mood_ratings for stamps on this passport
    // -----------------------------------------------------------------------
    const stampIdsForPassport = new Set<string>(stampsForPassport.map((s: StampRow) => s.id))
    const moodsForPassport = moodList.filter((m: MoodRow) => stampIdsForPassport.has(m.stamp_id))
    const avgMoodRating: number | null =
      moodsForPassport.length > 0
        ? moodsForPassport.reduce((sum: number, m: MoodRow) => sum + m.rating, 0) /
          moodsForPassport.length
        : null

    // -----------------------------------------------------------------------
    // return_visit_rate: users with >1 stamp on any stop / distinct stamp users
    // -----------------------------------------------------------------------
    const stampUserIds = new Set<string>(stampsForPassport.map((s: StampRow) => s.user_id))
    const totalStampUsers = stampUserIds.size
    let returnVisitRate = 0
    if (totalStampUsers > 0) {
      const userStampCounts = new Map<string, number>()
      for (const stamp of stampsForPassport) {
        userStampCounts.set(stamp.user_id, (userStampCounts.get(stamp.user_id) ?? 0) + 1)
      }
      const returners = [...userStampCounts.values()].filter((c: number) => c > 1).length
      returnVisitRate = returners / totalStampUsers
    }

    // -----------------------------------------------------------------------
    // expert_signoff_rate: for learning passports only
    //   count(stamps with verifier_id not null) / count(stamps)
    // -----------------------------------------------------------------------
    let expertSignoffRate = 0
    if (isLearning && stampsForPassport.length > 0) {
      const withVerifier = stampsForPassport.filter(
        (s: StampRow) => s.verifier_id !== null,
      ).length
      expertSignoffRate = withVerifier / stampsForPassport.length
    }

    // -----------------------------------------------------------------------
    // composite_score
    //   completion_rate*0.30 + (avg_mood/5)*0.30 + return_visit_rate*0.20 + expert_signoff_rate*0.20
    // -----------------------------------------------------------------------
    const normalizedMood = avgMoodRating !== null ? avgMoodRating / 5 : 0
    const compositeScore =
      completionRate * 0.3 +
      normalizedMood * 0.3 +
      returnVisitRate * 0.2 +
      expertSignoffRate * 0.2

    scores.push({
      passportId: pid,
      completionRate,
      avgMoodRating,
      returnVisitRate,
      expertSignoffRate,
      compositeScore,
    })
  }

  // -------------------------------------------------------------------------
  // Upsert scores into creator_quality_scores
  // -------------------------------------------------------------------------

  const now = new Date().toISOString()

  type UpsertRow = Omit<CreatorQualityScore, 'id'> & { id?: string }

  const upsertRows: UpsertRow[] = scores.map((s: ScoreResult): UpsertRow => ({
    passport_id: s.passportId,
    computed_at: now,
    completion_rate: s.completionRate,
    avg_mood_rating: s.avgMoodRating,
    return_visit_rate: s.returnVisitRate,
    expert_signoff_rate: s.expertSignoffRate,
    composite_score: s.compositeScore,
    pool_share_cents: null,
  }))

  const { error: upsertError } = await supabase
    .from('creator_quality_scores')
    .upsert(upsertRows, { onConflict: 'passport_id' })

  if (upsertError) {
    console.error('[compute-quality-scores] upsert error:', upsertError)
    return NextResponse.json({ error: 'Failed to upsert quality scores' }, { status: 500 })
  }

  const response: ComputeResponse = {
    computed: scores.length,
    scores,
  }

  return NextResponse.json(response)
}
