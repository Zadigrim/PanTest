'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FilterBar, type FilterState } from '@/components/marketplace/FilterBar'
import { PassportCoverThumbnail } from '@/components/design/PassportCoverThumbnail'
import { passportTypeIconFromClassifiers } from '@/lib/design/passport-type-icon'
import type { PassportWithDetails, CreatorQualityScore } from '@/lib/supabase/types'
import type { CoverSideData } from '@/lib/design/types'
import { isStudio, type SubscriptionFields } from '@/lib/roles'

// ─── Default filter state ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  distanceMiles:  null,
  budgets:        [],
  types:          [],
  accessibleOnly: false,
  travelerType:   null,
  sortBy:         'quality',
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

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
      return 0
  }
}

// ─── Explore passport card ────────────────────────────────────────────────────

const SPEND_TIER_LABELS: Record<string, string> = {
  free:       'Free',
  under_15:   'Under $15',
  '15_50':    '$15–$50',
  '50_150':   '$50–$150',
  '150_500':  '$150–$500',
  '500_plus': '$500+',
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours === 1) return '1 hr'
  return `${hours} hrs`
}

function ExploreCard({ passport }: { passport: PassportWithDetails }) {
  const authorName = passport.institution?.name ?? passport.creator?.display_name ?? 'Unknown'
  const avgRating  = passport.quality_score?.avg_mood_rating ?? null
  const completion = passport.quality_score?.completion_rate ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classifiers = (passport as any).classifiers as string[] | null | undefined
  const typeIcon = passportTypeIconFromClassifiers(classifiers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outsideData = (passport as any).cover_outside_data as CoverSideData | null | undefined

  return (
    // Whole card is a single tap target — one <Link> wrapping cover + body, so
    // the entire surface (not just the thumbnail) navigates. Mirrors
    // PassportCard.tsx. Better for touch; on desktop it reads the same.
    <Link
      href={`/explore/${passport.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-hairline bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      {/* Cover thumbnail — full width, 2:3 proportions */}
      <PassportCoverThumbnail
        title={passport.title}
        typeIcon={typeIcon}
        outsideData={outsideData}
        coverImageUrl={(passport as unknown as { cover_image_url?: string | null }).cover_image_url ?? null}
        coverThumbnail={(passport as unknown as { cover_thumbnail?: string | null }).cover_thumbnail ?? null}
        fallbackBg={passport.cover_bg_color ?? '0D1B2A'}
      />

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-navy">
          {passport.title}
        </h3>

        <p className="text-xs text-muted">
          {authorName}
          {passport.stop_count > 0 && (
            <>
              {' · '}
              <span>{passport.stop_count} {passport.stop_count === 1 ? 'stop' : 'stops'}</span>
            </>
          )}
        </p>

        {(avgRating !== null || completion !== null) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {avgRating !== null && (
              <span className="text-accent">
                {'★'.repeat(Math.floor(avgRating))}
                {'☆'.repeat(5 - Math.ceil(avgRating))}
                <span className="ml-1 font-medium text-navy">{avgRating.toFixed(1)}</span>
              </span>
            )}
            {completion !== null && (
              <span className="text-muted">
                {Math.round(completion * 100)}% complete
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            {passport.estimated_hours != null && (
              <span>{formatHours(passport.estimated_hours)}</span>
            )}
            {passport.expected_spend_tier && SPEND_TIER_LABELS[passport.expected_spend_tier] && (
              <span>{SPEND_TIER_LABELS[passport.expected_spend_tier]}</span>
            )}
          </div>

          {/* Decorative CTA — the whole card is the real link now, so this is
              a non-interactive label that still highlights on card hover. */}
          <span
            className="shrink-0 rounded-card border border-hairline bg-white px-2.5 py-1 text-xs font-medium text-navy transition-colors group-hover:border-green group-hover:text-green"
            aria-hidden="true"
          >
            View details
          </span>
        </div>
      </div>
    </Link>
  )
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
        className="h-8 w-8 animate-spin text-green"
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

export default function ExplorePage() {
  const [filters,   setFilters]   = useState<FilterState>(DEFAULT_FILTERS)
  const [passports, setPassports] = useState<PassportWithDetails[]>([])
  const [loading,   setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const supabase = createClient()

    // creator subscription fields are pulled into the join so the card
    // can show a Studio badge for creators with active Studio subs.
    const { data: rawPassports, error: passportsError } = await supabase
      .from('passports')
      .select(`
        *,
        creator:profiles!creator_id ( id, display_name, avatar_url, studio_status, studio_expires_at ),
        pages_count:passport_pages(count)
      `)
      .eq('is_published', true)
      // M2 leak guard (migration 069): consumable distribution-only
      // passports never appear in public Explore browse.
      .eq('distribution_only', false)
      // Publish-visibility + decency-review guard (migration 091). RLS
      // already enforces this; these are explicit defense-in-depth on the
      // public browse list.
      .eq('visibility', 'public')
      .eq('review_status', 'approved')
      .order('created_at', { ascending: false })

    if (passportsError) {
      setFetchError(passportsError.message)
      setLoading(false)
      return
    }

    const normalized: PassportWithDetails[] = ((rawPassports ?? []) as unknown[]).map((raw) => {
      const r = raw as Record<string, unknown>
      const pagesArr = r['pages_count'] as Array<{ count: number }> | number | null
      const pages_count = Array.isArray(pagesArr) ? (pagesArr[0]?.count ?? 0) : (typeof pagesArr === 'number' ? pagesArr : 0)
      const creator = r['creator'] as (SubscriptionFields & Record<string, unknown>) | null

      return {
        ...(r as Omit<PassportWithDetails, 'pages_count' | 'stops_count' | 'stop_count' | 'quality_score' | 'creator_is_certified' | 'creator_is_studio'>),
        pages_count,
        stops_count:         0,
        stop_count:          0,
        quality_score:       null,
        creator_is_certified:false,
        creator_is_studio:   isStudio(creator),
      } as PassportWithDetails
    })

    setPassports(normalized)
    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const filtered = passports
    .filter((p) => matchesBudget(p.is_free, p.price_cents, filters.budgets))
    .filter((p) => matchesType(p.passport_type, filters.types))
    .filter((p) => matchesAccessible(p.transit_accessible, p.wheelchair_accessible, filters.accessibleOnly))
    .filter((p) => matchesTravelerType(p.traveler_types, filters.travelerType))
    .sort((a, b) => sortPassports(a, b, filters.sortBy))

  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

        {fetchError && (
          <div
            role="alert"
            className="mb-6 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Could not load passports: {fetchError}
          </div>
        )}

        {loading && <Spinner />}

        {!loading && !fetchError && passports.length === 0 && (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="text-5xl" aria-hidden="true">🗺️</span>
            <h2 className="mt-4 text-lg font-semibold text-navy">No passports yet</h2>
            <p className="mt-1 text-sm text-muted">
              Check back soon — creators are building experiences now.
            </p>
          </div>
        )}

        {!loading && !fetchError && passports.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="text-5xl" aria-hidden="true">🔍</span>
            <h2 className="mt-4 text-lg font-semibold text-navy">
              No passports match your filters
            </h2>
            <p className="mt-1 text-sm text-muted">
              Try adjusting the budget, type, or accessibility options.
            </p>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="mt-4 rounded-panel bg-green px-4 py-2 text-sm font-medium text-white hover:bg-green transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <>
            <p className="mb-4 text-xs text-muted">
              {filtered.length} {filtered.length === 1 ? 'passport' : 'passports'}
            </p>
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              aria-label="Passport catalogue"
            >
              {filtered.map((passport) => (
                <ExploreCard key={passport.id} passport={passport} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
