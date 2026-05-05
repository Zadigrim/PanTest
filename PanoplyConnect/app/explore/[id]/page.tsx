import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type {
  Passport,
  PassportPage,
  Stop,
  Profile,
} from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PassportFull extends Passport {
  pages: (PassportPage & { stops: Stop[] })[]
  creator:      Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'> | null
  institution:  { id: string; name: string; slug: string; logo_url: string | null } | null
  quality_score: { composite_score: number; avg_mood_rating: number; completion_rate: number } | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('passports')
    .select('title, description')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Passport · PanoplyConnect' }
  return {
    title:       `${data.title} · Explore · PanoplyConnect`,
    description: data.description ?? undefined,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  const full  = Math.floor(value)
  const half  = value - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      className="space-y-3"
    >
      <h2
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className="text-base font-semibold text-panoply-navy"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExplorePassportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ── Fetch passport + pages + stops ─────────────────────────────────────────
  const { data: passportRow, error: passportError } = await supabase
    .from('passports')
    .select(`
      *,
      creator:profiles!creator_id ( id, display_name, avatar_url, bio ),
      pages:passport_pages (
        *,
        stops ( * )
      )
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (passportError || !passportRow) {
    notFound()
  }

  const raw = passportRow as Record<string, unknown>

  const creatorRaw = raw['creator']
  const creator = Array.isArray(creatorRaw)
    ? (creatorRaw[0] ?? null) as Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'> | null
    : creatorRaw as Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'> | null

  const institution = null
  const quality_score = null

  const pagesRaw = (raw['pages'] ?? []) as Array<Record<string, unknown>>
  const pages: PassportFull['pages'] = pagesRaw
    .map((p) => ({
      ...(p as unknown as PassportPage),
      stops: ((p['stops'] ?? []) as Stop[]).sort((a, b) => a.stop_order - b.stop_order),
    }))
    .sort((a, b) => a.page_order - b.page_order)

  const passport: PassportFull = {
    ...(raw as unknown as Passport),
    pages,
    creator,
    institution,
    quality_score,
  }

  const allStops   = pages.flatMap((p) => p.stops)
  const totalStops = allStops.length
  const prizePages = pages.filter((p) => p.prize_description)

  const authorName = institution?.name ?? creator?.display_name ?? null

  const avgRating  = quality_score?.avg_mood_rating ?? null
  const completion = quality_score?.completion_rate ?? null
  const composite  = quality_score?.composite_score ?? null

  const coverColor = passport.cover_bg_color ?? '#0D1B2A'

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero cover ──────────────────────────────────────────────────────── */}
      <div
        className="relative w-full"
        style={{ height: 240, backgroundColor: coverColor }}
        aria-hidden="true"
      >
        {passport.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={passport.cover_image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : passport.cover_emblem ? (
          <span className="absolute inset-0 flex items-center justify-center text-8xl leading-none select-none">
            {passport.cover_emblem}
          </span>
        ) : null}
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

        {/* Back link */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal rounded-sm"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Explore
        </Link>

        {/* ── Title + primary action ──────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-panoply-navy leading-tight">
              {passport.title}
            </h1>
            {authorName && (
              <p className="mt-1 text-sm text-panoply-gray-3">
                by{' '}
                {creator ? (
                  <a
                    href={`/creator/${creator.id}`}
                    className="text-panoply-navy font-medium hover:underline"
                  >
                    {creator.display_name ?? 'Unknown creator'}
                  </a>
                ) : (
                  authorName
                )}
              </p>
            )}
          </div>

          {/* Import a stop from this passport */}
          <div className="shrink-0 sm:pl-4">
            <Link
              href={`/stops?passport=${passport.id}`}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-panel px-5 text-sm font-medium',
                'border border-panoply-teal text-panoply-teal bg-white hover:bg-panoply-teal-lt transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
              )}
            >
              Import a stop
            </Link>
          </div>
        </div>

        {/* ── Badge row ─────────────────────────────────────────────────────── */}
        {(passport.is_free || passport.transit_accessible || passport.wheelchair_accessible || passport.award_year || passport.shortlisted) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {passport.is_free && <Badge variant="free">Free</Badge>}
            {passport.transit_accessible && passport.wheelchair_accessible && (
              <Badge variant="accessible">Accessible</Badge>
            )}
            {passport.award_year && (
              <Badge variant="award">Award {passport.award_year}</Badge>
            )}
            {passport.shortlisted && (
              <Badge variant="certified">Shortlisted</Badge>
            )}
            {passport.passport_type && (
              <Badge variant="default">
                {passport.passport_type.charAt(0).toUpperCase() + passport.passport_type.slice(1)}
              </Badge>
            )}
          </div>
        )}

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {(avgRating !== null || completion !== null || composite !== null || totalStops > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            {avgRating !== null && <StarRating value={avgRating} />}
            {completion !== null && (
              <span className="text-panoply-gray-3">
                {Math.round(completion * 100)}% completion rate
              </span>
            )}
            {composite !== null && (
              <span className="text-panoply-gray-3">
                Quality score: {(composite * 100).toFixed(0)}
              </span>
            )}
            {totalStops > 0 && (
              <span className="text-panoply-gray-3">
                {totalStops} {totalStops === 1 ? 'stop' : 'stops'}
              </span>
            )}
            {passport.estimated_hours != null && (
              <span className="text-panoply-gray-3">
                ~{formatHours(passport.estimated_hours)}
              </span>
            )}
          </div>
        )}

        <hr className="my-8 border-panoply-gray-2" />

        <div className="space-y-10">

          {/* About */}
          {passport.description && (
            <Section title="About">
              <p className="text-sm leading-relaxed text-panoply-gray-3 whitespace-pre-line">
                {passport.description}
              </p>
            </Section>
          )}

          {/* Expected spend */}
          {(passport.expected_spend_tier || !passport.is_free) && (
            <Section title="Expected spend">
              <div className="flex flex-wrap items-center gap-4 text-sm text-panoply-navy">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold">
                    {passport.is_free ? 'Free' : passport.price_cents ? `$${(passport.price_cents / 100).toFixed(2)}` : 'Paid'}
                  </span>
                  <span className="text-panoply-gray-3 text-xs">passport</span>
                </div>
                {passport.expected_spend_tier && SPEND_TIER_LABELS[passport.expected_spend_tier] && (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold">
                      {SPEND_TIER_LABELS[passport.expected_spend_tier]}
                    </span>
                    <span className="text-panoply-gray-3 text-xs">on the ground</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Stops */}
          {totalStops > 0 && (
            <Section title="Stops">
              <ol className="space-y-2">
                {pages.map((page) =>
                  page.stops.map((stop, idx) => {
                    const globalIdx =
                      pages
                        .slice(0, pages.indexOf(page))
                        .reduce((acc, p) => acc + p.stops.length, 0) + idx + 1

                    return (
                      <li
                        key={stop.id}
                        className="flex items-start gap-3 rounded-card border border-panoply-gray-2 bg-panoply-gray-1 px-4 py-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panoply-teal text-white text-xs font-semibold">
                          {globalIdx}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-panoply-navy">{stop.name}</p>
                          {(stop.address_street || stop.address_city) && (
                            <p className="mt-0.5 text-xs text-panoply-gray-3">
                              {[stop.address_street, stop.address_city, stop.address_state]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                          {stop.learning_objective && (
                            <p className="mt-0.5 text-xs text-panoply-gray-3 italic">
                              {stop.learning_objective}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {stop.stamp_icon && (
                            <span className="text-lg leading-none" aria-hidden="true">
                              {stop.stamp_icon}
                            </span>
                          )}
                          <Link
                            href={`/stops?stop=${stop.id}`}
                            className="rounded-card border border-panoply-gray-2 px-2.5 py-1 text-xs font-medium text-panoply-navy hover:border-panoply-teal hover:text-panoply-teal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal"
                          >
                            Import stop
                          </Link>
                        </div>
                      </li>
                    )
                  })
                )}
              </ol>
            </Section>
          )}

          {/* Prize on completion */}
          {prizePages.length > 0 && (
            <Section title="Prize on completion">
              <div className="space-y-3">
                {prizePages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-start gap-3 rounded-panel border border-panoply-amber bg-amber-50 px-4 py-3"
                  >
                    <span className="text-xl leading-none" aria-hidden="true">🏆</span>
                    <div>
                      {page.section_title && (
                        <p className="text-sm font-semibold text-panoply-navy">
                          {page.section_title}
                        </p>
                      )}
                      <p className="mt-0.5 text-sm text-panoply-gray-3">
                        {page.prize_description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* About the creator */}
          {(creator?.display_name || creator?.bio) && (
            <Section title="About the creator">
              <div className="flex items-start gap-4 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 p-4">
                {creator?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name ?? 'Creator avatar'}
                    className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-panoply-gray-2"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-panoply-teal text-white text-base font-semibold select-none">
                    {(creator?.display_name ?? '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-panoply-navy">
                    {creator?.display_name ?? 'Unknown creator'}
                  </p>
                  {creator?.bio && (
                    <p className="mt-1 text-sm text-panoply-gray-3 leading-relaxed line-clamp-4">
                      {creator.bio}
                    </p>
                  )}
                  {creator && (
                    <a
                      href={`/creator/${creator.id}`}
                      className="mt-2 inline-block text-xs font-medium text-panoply-teal hover:underline"
                    >
                      View all passports
                    </a>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Bottom CTA — import a stop */}
          <div className="flex justify-center border-t border-panoply-gray-2 pt-8">
            <Link
              href={`/stops?passport=${passport.id}`}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-panel px-6 text-sm font-semibold',
                'bg-panoply-teal text-white hover:bg-panoply-teal-dk transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal'
              )}
            >
              Import a stop from this passport
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
