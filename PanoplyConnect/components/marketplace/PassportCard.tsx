'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PassportWithDetails } from '@/lib/supabase/types'

// ─── Spend-tier labels ────────────────────────────────────────────────────────

const SPEND_TIER_LABELS: Record<string, string> = {
  free:       'Free',
  under_15:   'Under $15',
  '15_50':    '$15–$50',
  '50_150':   '$50–$150',
  '150_500':  '$150–$500',
  '500_plus': '$500+',
}

// ─── Star-rating helper ───────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  const full  = Math.floor(value)
  const empty = 5 - Math.ceil(value)
  const half  = 5 - full - empty // 0 or 1

  return (
    <span
      className="text-panoply-amber"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {'★'.repeat(full)}
      {half ? '½' : ''}
      {'☆'.repeat(empty)}
      <span className="ml-1 font-medium text-panoply-navy">{value.toFixed(1)}</span>
    </span>
  )
}

// ─── Estimated-time helper ────────────────────────────────────────────────────

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours === 1) return '1 hr'
  return `${hours} hrs`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PassportCardProps {
  passport: PassportWithDetails
  isOwned?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PassportCard({ passport, isOwned = false }: PassportCardProps) {
  const {
    id,
    title,
    cover_bg_color,
    cover_emblem,
    is_free,
    transit_accessible,
    wheelchair_accessible,
    creator,
    institution,
    stop_count,
    quality_score,
    creator_is_certified,
    award_year,
    expected_spend_tier,
    estimated_hours,
  } = passport

  const authorName = institution?.name ?? creator?.display_name ?? 'Unknown'
  const avgRating  = quality_score?.avg_mood_rating ?? null
  const completion = quality_score?.completion_rate ?? null
  const showFree   = Boolean(is_free)
  const showA11y   = Boolean(transit_accessible && wheelchair_accessible)

  return (
    <Link
      href={`/passport/${id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-panoply-gray-2',
        'bg-white shadow-sm transition-shadow hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
      )}
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div
        className="flex h-28 items-center justify-center"
        style={{ backgroundColor: cover_bg_color ?? '#0D1B2A' }}
        aria-hidden="true"
      >
        {cover_emblem ? (
          <span className="select-none text-5xl leading-none">{cover_emblem}</span>
        ) : (
          <span className="select-none text-4xl leading-none opacity-30">🗺</span>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-3">

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-panoply-navy">
          {title}
        </h3>

        {/* Author · stop count */}
        <p className="text-xs text-panoply-gray-3">
          {authorName}
          {stop_count > 0 && (
            <>
              {' · '}
              <span>{stop_count} {stop_count === 1 ? 'stop' : 'stops'}</span>
            </>
          )}
        </p>

        {/* Badge row */}
        {(showFree || showA11y || creator_is_certified || award_year) && (
          <div className="flex flex-wrap gap-1">
            {showFree && <Badge variant="free">Free</Badge>}
            {showA11y && <Badge variant="accessible">Accessible</Badge>}
            {creator_is_certified && <Badge variant="certified">Design Certified</Badge>}
            {award_year && <Badge variant="award">Award {award_year}</Badge>}
          </div>
        )}

        {/* Quality metrics */}
        {(avgRating !== null || completion !== null) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {avgRating !== null && <StarRating value={avgRating} />}
            {completion !== null && (
              <span className="text-panoply-gray-3">
                {Math.round(completion * 100)}% complete
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes footer to bottom */}
        <div className="flex-1" />

        {/* Footer: time + spend + CTA */}
        <div className="flex items-center justify-between gap-2 border-t border-panoply-gray-2 pt-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-panoply-gray-3">
            {estimated_hours != null && (
              <span>{formatHours(estimated_hours)}</span>
            )}
            {expected_spend_tier && SPEND_TIER_LABELS[expected_spend_tier] && (
              <span>{SPEND_TIER_LABELS[expected_spend_tier]}</span>
            )}
          </div>

          {isOwned ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              tabIndex={-1}
              aria-label={`Open ${title}`}
            >
              Open →
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="shrink-0"
              tabIndex={-1}
              aria-label={`Get passport: ${title}`}
            >
              Get passport
            </Button>
          )}
        </div>
      </div>
    </Link>
  )
}
