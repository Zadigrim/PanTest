'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilterBar, type FilterState } from '@/components/marketplace/FilterBar'
import { PassportCard } from '@/components/marketplace/PassportCard'
import type { PassportWithDetails, CreatorQualityScore } from '@/lib/supabase/types'

// ─── Default filter state ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  distanceMiles: null,
  budgets:       [],
  types:         [],
  accessibleOnly: false,
  travelerType:  null,
  sortBy:        'quality',
}

// ─── Spend-tier → budget-option mapping ──────────────────────────────────────

function matchesBudget(
  isFree: boolean,
  priceCents: number | null,
  budgets: string[]
): boolean {
  if (budgets.length === 0) return true
  if (isFree) return budgets.includes('free')
  const price = priceCents ?? 0
  return budgets.some((b) => {
    if (b === 'free')     return isFree
    if (b === 'under_15') return price < 1500
    if (b === '15_50')    return price >= 1500 && price < 5000
    if (b === '50_150')   return price >= 5000 && price < 15000
    if (b === '150_500')  return price >= 15000 && price < 50000
    if (b === '500_plus') return price >= 50000
    return false
  })
}

function matchesType(passportType: string | null, types: string[]): boolean {
  if (types.length === 0) return true
  if (!passportType) return false
  return types.includes(passportType)
}

function matchesAccessible(
  transit: boolean | null,
  wheelchair: boolean | null,
  accessibleOnly: boolean
): boolean {
  if (!accessibleOnly) return true
  return Boolean(transit) && Boolean(wheelchair)
}

function matchesTravelerType(
  travelerTypes: string[] | null,
  travelerType: string | null
): boolean {
  if (!travelerType) return true
  if (!travelerTypes || travelerTypes.length === 0) return false
  return travelerTypes.includes(travelerType)
}

// ─── Sort comparator ──────────────────────────────────────────────────────────

function sortPassports(
  a: PassportWithDetails,
  b: PassportWithDetails,
  sortBy: FilterState['sortBy']
): number {
  switch (sortBy) {
    case 'quality': {
      const sa = a.quality_score?.composite_score ?? -1
      const sb = b.quality_score?.composite_score ?? -1
      return sb - sa
    }
    case 'newest':
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    case 'most_completed': {
      const ca = a.quality_score?.completion_rate ?? -1
      const cb = b.quality_score?.completion_rate ?? -1
      return cb - ca
    }
    case 'price_asc': {
      const pa = a.is_free ? 0 : (a.price_cents ?? 0)
      const pb = b.is_free ? 0 : (b.price_cents ?? 0)
      return pa - pb
    }
    case 'price_desc': {
      const pa = a.is_free ? 0 : (a.price_cents ?? 0)
      const pb = b.is_free ? 0 : (b.price_cents ?? 0)
      return pb - pa
    }
    case 'distance':
    default:
      return 0 // Distance requires geolocation; preserve server order for MVP
  }
}

// ─── Raw fetch result type ────────────────────────────────────────────────────

interface RawPassportRow {
  id: string
  creator_id: string
  proprietor_id: string | null
  title: string
  description: string | null
  passport_type: string
  cover_bg_color: string | null
  cover_emblem: string | null
  cover_image_url: string | null
  is_published: boolean
  is_free: boolean
  price_cents: number | null
  expected_spend_tier: string | null
  transit_accessible: boolean | null
  wheelchair_accessible: boolean | null
  estimated_hours: number | null
  traveler_types: string[] | null
  award_year: number | null
  shortlisted: boolean | null
  status: string | null
  created_at: string
  updated_at: string
  // joined
  creator: { id: string; display_name: string | null; avatar_url: string | null } | null
  institution: { id: string; name: string; slug: string; logo_url: string | null } | null  // populated separately if needed
  pages_count: number
  creator_is_certified: boolean
  quality_score: CreatorQualityScore | null
}

function toPassportWithDetails(row: RawPassportRow): PassportWithDetails {
  return {
    ...row,
    stop_count: row.stops_count,
  } as PassportWithDetails
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div
      className="flex items-center justify-center py-24"
      role="status"
      aria-label="Loading passports"
    >
      <svg
        className="h-8 w-8 animate-spin text-panoply-teal"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
        />
      </svg>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS)
  const [passports, setPassports] = useState<PassportWithDetails[]>([])
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set())
  const [loading,  setLoading]  = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const supabase = createClient()

    // Fetch published passports ordered by composite_score DESC
    const { data: rawPassports, error: passportsError } = await supabase
      .from('passports')
      .select(`
        *,
        creator:profiles!creator_id ( id, display_name, avatar_url ),
        pages_count:passport_pages(count),
        quality_score:creator_quality_scores (
          composite_score,
          avg_mood_rating,
          completion_rate,
          return_visit_rate,
          expert_signoff_rate,
          pool_share_cents,
          id,
          passport_id,
          computed_at
        )
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (passportsError) {
      setFetchError(passportsError.message)
      setLoading(false)
      return
    }

    // Normalize aggregation count shapes from PostgREST
    const normalized: PassportWithDetails[] = ((rawPassports ?? []) as unknown[]).map((raw) => {
      const r = raw as Record<string, unknown>
      const pagesArr  = r['pages_count']  as Array<{ count: number }> | number | null
      const qsArr     = r['quality_score'] as unknown

      const pages_count  = Array.isArray(pagesArr)  ? (pagesArr[0]?.count  ?? 0) : (typeof pagesArr  === 'number' ? pagesArr  : 0)
      const quality_score = Array.isArray(qsArr) ? (qsArr[0] ?? null) : ((qsArr as CreatorQualityScore | null) ?? null)

      return {
        ...(r as Omit<PassportWithDetails, 'pages_count' | 'stops_count' | 'stop_count' | 'quality_score' | 'creator_is_certified'>),
        pages_count,
        stops_count: 0,
        stop_count: 0,
        quality_score,
        creator_is_certified: false,
      } as PassportWithDetails
    })

    setPassports(normalized)

    // Fetch the current user's owned passports
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: acquisitions } = await supabase
        .from('acquisitions')
        .select('passport_id')
        .eq('user_id', user.id)

      setOwnedIds(new Set((acquisitions ?? []).map((a) => a.passport_id)))
    }

    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  // ── Client-side filtering ───────────────────────────────────────────────────
  const filtered = passports
    .filter((p) => matchesBudget(p.is_free, p.price_cents, filters.budgets))
    .filter((p) => matchesType(p.passport_type, filters.types))
    .filter((p) => matchesAccessible(p.transit_accessible, p.wheelchair_accessible, filters.accessibleOnly))
    .filter((p) => matchesTravelerType(p.traveler_types, filters.travelerType))
    .sort((a, b) => sortPassports(a, b, filters.sortBy))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Sticky filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {/* Error state */}
        {fetchError && (
          <div
            role="alert"
            className="mb-6 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Could not load passports: {fetchError}
          </div>
        )}

        {/* Loading spinner */}
        {loading && <Spinner />}

        {/* Empty state — no passports at all */}
        {!loading && !fetchError && passports.length === 0 && (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="text-5xl" aria-hidden="true">🗺️</span>
            <h2 className="mt-4 text-lg font-semibold text-panoply-navy">
              No passports yet
            </h2>
            <p className="mt-1 text-sm text-panoply-gray-3">
              Check back soon — creators are building experiences now.
            </p>
          </div>
        )}

        {/* Empty state — filters too narrow */}
        {!loading && !fetchError && passports.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="text-5xl" aria-hidden="true">🔍</span>
            <h2 className="mt-4 text-lg font-semibold text-panoply-navy">
              No passports match your filters
            </h2>
            <p className="mt-1 text-sm text-panoply-gray-3">
              Try adjusting the budget, type, or accessibility options.
            </p>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="mt-4 rounded-panel bg-panoply-teal px-4 py-2 text-sm font-medium text-white hover:bg-[#0F6E56] transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Passport grid */}
        {!loading && filtered.length > 0 && (
          <>
            <p className="mb-4 text-xs text-panoply-gray-3">
              {filtered.length} {filtered.length === 1 ? 'passport' : 'passports'}
            </p>

            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Passport catalogue"
            >
              {filtered.map((passport) => (
                <PassportCard
                  key={passport.id}
                  passport={passport}
                  isOwned={ownedIds.has(passport.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
