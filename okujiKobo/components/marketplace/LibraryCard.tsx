'use client'

import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { resolveCoverImage, type CoverResolverInput } from '@/lib/cover/resolve'
import type { Acquisition, Passport } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryCardProps {
  acquisition: Acquisition
  passport: Passport
  stampCount: number
  totalStops: number
  lastStampedAt?: string
}

// ─── Progress state helper ────────────────────────────────────────────────────

type ProgressState = 'not_started' | 'in_progress' | 'completed'

function getProgressState(stampCount: number, totalStops: number): ProgressState {
  if (stampCount === 0) return 'not_started'
  if (totalStops > 0 && stampCount >= totalStops) return 'completed'
  return 'in_progress'
}

// ─── Relative-time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  pct: number          // 0–100
  state: ProgressState
}

function ProgressBar({ pct, state }: ProgressBarProps) {
  const fillColor =
    state === 'completed'  ? 'bg-green'
    : state === 'in_progress' ? 'bg-green'
    : 'bg-hairline'

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-hairline"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300', fillColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── State badge ──────────────────────────────────────────────────────────────

function StatePill({ state }: { state: ProgressState }) {
  if (state === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-card bg-cream px-2 py-0.5 text-xs font-medium text-green">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Completed
      </span>
    )
  }
  if (state === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 rounded-card bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 4v2l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-card bg-hairline px-2 py-0.5 text-xs font-medium text-muted">
      Not Started
    </span>
  )
}

// ─── Cover thumbnail ──────────────────────────────────────────────────────────

interface CoverProps {
  bgColor: string | null
  emblem: string | null
  resolverInput: CoverResolverInput
}

function Cover({ bgColor, emblem, resolverInput }: CoverProps) {
  const resolved = resolveCoverImage(resolverInput)
  if (resolved) {
    const objectPosition = resolved.crop === 'right-panel' ? 'right top' : 'center center'
    return (
      <div
        className="h-full w-full"
        style={{ backgroundColor: `#${resolved.bgColor}` }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.url}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          style={{ objectPosition, opacity: resolved.opacity }}
        />
      </div>
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: bgColor ?? '#0D1B2A' }}
      aria-hidden="true"
    >
      {emblem ? (
        <span className="select-none text-3xl leading-none">{emblem}</span>
      ) : (
        <span className="select-none text-2xl leading-none opacity-30">🗺</span>
      )}
    </div>
  )
}

// ─── LibraryCard ─────────────────────────────────────────────────────────────

export function LibraryCard({
  acquisition,
  passport,
  stampCount,
  totalStops,
  lastStampedAt,
}: LibraryCardProps) {
  const {
    id,
    title,
    cover_bg_color,
    cover_emblem,
    cover_image_url,
    estimated_hours,
  } = passport

  const state = getProgressState(stampCount, totalStops)
  const pct   = totalStops > 0 ? Math.min(100, Math.round((stampCount / totalStops) * 100)) : 0

  return (
    <div
      className={cn(
        'flex gap-3 rounded-panel border border-hairline bg-white p-3 shadow-sm',
        'transition-shadow hover:shadow-md'
      )}
    >
      {/* ── Cover thumbnail ───────────────────────────────────────────────── */}
      <Link
        href={`/passport/${id}`}
        className="block h-20 w-16 shrink-0 overflow-hidden rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Cover
          bgColor={cover_bg_color}
          emblem={cover_emblem}
          resolverInput={{
            cover_outside_data: (passport as unknown as { cover_outside_data?: CoverResolverInput['cover_outside_data'] }).cover_outside_data ?? null,
            cover_image_url: cover_image_url ?? null,
            cover_thumbnail: (passport as unknown as { cover_thumbnail?: string | null }).cover_thumbnail ?? null,
            cover_bg_color: cover_bg_color ?? null,
          }}
        />
      </Link>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">

        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/passport/${id}`}
            className="line-clamp-2 text-sm font-semibold leading-snug text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-sm"
          >
            {title}
          </Link>
          <StatePill state={state} />
        </div>

        {/* Progress bar + stamp count */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar pct={pct} state={state} />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {stampCount}/{totalStops} stops
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {estimated_hours != null && (
            <span>
              {estimated_hours < 1
                ? `${Math.round(estimated_hours * 60)} min`
                : estimated_hours === 1
                  ? '1 hr'
                  : `${estimated_hours} hrs`}
            </span>
          )}
          <span>
            Acquired {relativeTime(acquisition.acquired_at)}
          </span>
          {lastStampedAt && state !== 'not_started' && (
            <span>Last stamp {relativeTime(lastStampedAt)}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-0.5">
          {state === 'completed' ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/passport/${id}`}>View passport</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/passport/${id}/journal`}>Journal</Link>
              </Button>
            </>
          ) : state === 'in_progress' ? (
            <>
              <Button variant="default" size="sm" asChild>
                <Link href={`/passport/${id}`}>Continue →</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/passport/${id}/journal`}>Journal</Link>
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link href={`/passport/${id}`}>Start passport →</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
