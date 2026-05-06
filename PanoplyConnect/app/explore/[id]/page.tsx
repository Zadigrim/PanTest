import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'
import { passportTypeIcon } from '@/lib/design/passport-type-icon'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StopRow {
  id: string
  name: string
  stop_order: number
  address_street: string | null
  address_city: string | null
  address_state: string | null
  learning_objective: string | null
  stamp_icon: string | null
  classifiers: string[] | null
  is_shared: boolean | null
}

interface PageRow {
  id: string
  page_order: number
  section_title: string | null
  section_name: string
  prize_description: string | null
  stops: StopRow[]
}

interface PassportRow {
  id: string
  title: string
  description: string | null
  cover_bg_color: string | null
  cover_emblem: string | null
  cover_outside_data: { front_bg?: string; image_url?: string; image_opacity?: number } | null
  passport_type: string | null
  is_published: boolean
  is_free: boolean | null
  price_cents: number | null
  transit_accessible: boolean | null
  wheelchair_accessible: boolean | null
  expected_spend_tier: string | null
  estimated_hours: number | null
  creator_id: string
}

interface CreatorRow {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
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
    title: `${(data as { title: string }).title} · Explore · PanoplyConnect`,
    description: (data as { description: string | null }).description ?? undefined,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPEND_TIER_LABELS: Record<string, string> = {
  free:       'Free',
  under_15:   'Under $15',
  '15_50':    '$15–$50',
  '50_150':   '$50–$150',
  '150_500':  '$150–$500',
  '500_plus': '$500+',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-panoply-navy">{title}</h2>
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

  // ── Fetch passport (simple select, no profile join to avoid RLS issues) ────
  const { data: passportRaw, error: passportError } = await supabase
    .from('passports')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (passportError || !passportRaw) {
    notFound()
  }

  const passport = passportRaw as unknown as PassportRow

  // ── Fetch pages + stops separately ────────────────────────────────────────
  const { data: pagesRaw } = await supabase
    .from('passport_pages')
    .select('id, page_order, section_title, section_name, prize_description')
    .eq('passport_id', id)
    .order('page_order', { ascending: true })

  const pageIds = (pagesRaw ?? []).map((p: { id: string }) => p.id)

  const { data: stopsRaw } =
    pageIds.length > 0
      ? await supabase
          .from('stops')
          .select(
            'id, name, stop_order, address_street, address_city, address_state, learning_objective, stamp_icon, classifiers, is_shared, page_id',
          )
          .in('page_id', pageIds)
          .order('stop_order', { ascending: true })
      : { data: [] }

  // ── Fetch creator separately (graceful fallback if profile not accessible) ─
  let creator: CreatorRow | null = null
  try {
    const { data: profileRaw } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio')
      .eq('id', passport.creator_id)
      .maybeSingle()
    creator = profileRaw as CreatorRow | null
  } catch {
    // profile read failed — continue without creator info
  }

  // ── Assemble pages with stops ─────────────────────────────────────────────
  const pages: PageRow[] = (pagesRaw ?? []).map((p: Record<string, unknown>) => ({
    id: p['id'] as string,
    page_order: p['page_order'] as number,
    section_title: p['section_title'] as string | null,
    section_name: p['section_name'] as string,
    prize_description: p['prize_description'] as string | null,
    stops: ((stopsRaw ?? []) as Array<Record<string, unknown>>)
      .filter((s) => s['page_id'] === p['id'])
      .sort((a, b) => (a['stop_order'] as number) - (b['stop_order'] as number))
      .map((s) => ({
        id: s['id'] as string,
        name: s['name'] as string,
        stop_order: s['stop_order'] as number,
        address_street: s['address_street'] as string | null,
        address_city: s['address_city'] as string | null,
        address_state: s['address_state'] as string | null,
        learning_objective: s['learning_objective'] as string | null,
        stamp_icon: s['stamp_icon'] as string | null,
        classifiers: s['classifiers'] as string[] | null,
        is_shared: s['is_shared'] as boolean | null,
      })),
  }))

  const allStops = pages.flatMap((p) => p.stops)
  const prizePages = pages.filter((p) => p.prize_description)
  const hasSharedStops = allStops.some((s) => s.is_shared)

  const coverBg = (passport.cover_outside_data as Record<string, string> | null)?.['front_bg']
    ?? passport.cover_bg_color
    ?? '0D1B2A'
  const coverImageUrl = (passport.cover_outside_data as Record<string, string | null> | null)?.['image_url'] ?? null

  const typeIcon = passportTypeIcon(passport.passport_type ?? null)

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero cover — 2:3 proportions, full width ─────────────────────── */}
      <div
        className="relative w-full"
        style={{ paddingBottom: '66.67%', backgroundColor: `#${coverBg}` }}
      >
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : passport.cover_emblem ? (
          <span className="absolute inset-0 flex items-center justify-center text-8xl leading-none select-none">
            {passport.cover_emblem}
          </span>
        ) : null}

        {/* Type icon badge */}
        <span
          className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          aria-label={`Passport type: ${passport.passport_type ?? 'general'}`}
        >
          {typeIcon}
        </span>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

        {/* Back link */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1 text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
        >
          ← Back to Explore
        </Link>

        {/* Title + author */}
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-tight" aria-hidden="true">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-panoply-navy leading-tight">
              {passport.title}
            </h1>
            {creator?.display_name && (
              <p className="mt-1 text-sm text-panoply-gray-3">
                by{' '}
                <span className="font-medium text-panoply-navy">
                  {creator.display_name}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Badge row */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {passport.expected_spend_tier && SPEND_TIER_LABELS[passport.expected_spend_tier] && (
            <span className="rounded-full border border-panoply-gray-2 px-2.5 py-1 text-panoply-gray-3">
              {SPEND_TIER_LABELS[passport.expected_spend_tier]} on the ground
            </span>
          )}
          {passport.is_free && (
            <span className="rounded-full bg-panoply-teal-lt px-2.5 py-1 font-medium text-panoply-teal-dk">
              Free passport
            </span>
          )}
          {passport.transit_accessible && (
            <span className="rounded-full border border-panoply-gray-2 px-2.5 py-1 text-panoply-gray-3">
              🚌 Transit friendly
            </span>
          )}
          {passport.wheelchair_accessible && (
            <span className="rounded-full border border-panoply-gray-2 px-2.5 py-1 text-panoply-gray-3">
              ♿ Wheelchair accessible
            </span>
          )}
          {passport.passport_type && (
            <span className="rounded-full border border-panoply-gray-2 px-2.5 py-1 text-panoply-gray-3 capitalize">
              {passport.passport_type}
            </span>
          )}
        </div>

        {/* Stats row */}
        {(pages.length > 0 || allStops.length > 0) && (
          <p className="mt-3 text-sm text-panoply-gray-3">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            {allStops.length > 0 && (
              <>
                {' · '}
                {allStops.length} {allStops.length === 1 ? 'stop' : 'stops'}
              </>
            )}
            {passport.estimated_hours != null && (
              <>
                {' · ~'}
                {passport.estimated_hours < 1
                  ? `${Math.round(passport.estimated_hours * 60)} min`
                  : `${passport.estimated_hours} hr`}
              </>
            )}
          </p>
        )}

        <hr className="my-6 border-panoply-gray-2" />

        <div className="space-y-8">

          {/* Description */}
          {passport.description && (
            <Section title="About">
              <p className="text-sm leading-relaxed text-panoply-gray-3 whitespace-pre-line">
                {passport.description}
              </p>
            </Section>
          )}

          {/* Stops */}
          {allStops.length > 0 && (
            <Section title="Stops">
              <ol className="space-y-2">
                {pages.map((page) =>
                  page.stops.map((stop, idx) => {
                    const globalIdx =
                      pages
                        .slice(0, pages.indexOf(page))
                        .reduce((acc, p) => acc + p.stops.length, 0) +
                      idx +
                      1
                    return (
                      <li
                        key={stop.id}
                        className="flex items-start gap-3 rounded-card border border-panoply-gray-2 bg-panoply-gray-1 px-4 py-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panoply-teal text-white text-xs font-semibold">
                          {globalIdx}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-panoply-navy">{stop.name}</p>
                          {(stop.address_street || stop.address_city) && (
                            <p className="mt-0.5 text-xs text-panoply-gray-3">
                              {[stop.address_street, stop.address_city, stop.address_state]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                          {stop.learning_objective && (
                            <p className="mt-0.5 text-xs italic text-panoply-gray-3">
                              {stop.learning_objective}
                            </p>
                          )}
                          {(stop.classifiers ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(stop.classifiers ?? []).slice(0, 3).map((c) => (
                                <span
                                  key={c}
                                  className="rounded-card bg-panoply-teal-lt px-1.5 py-0.5 text-[10px] font-medium text-panoply-teal-dk capitalize"
                                >
                                  {c.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {stop.stamp_icon && (
                          <span className="text-lg leading-none shrink-0" aria-hidden="true">
                            {stop.stamp_icon}
                          </span>
                        )}
                      </li>
                    )
                  })
                )}
              </ol>
            </Section>
          )}

          {/* Prize pages */}
          {prizePages.length > 0 && (
            <Section title="Prize on completion">
              <div className="space-y-2">
                {prizePages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-start gap-3 rounded-panel border border-panoply-amber bg-amber-50 px-4 py-3"
                  >
                    <span className="text-xl" aria-hidden="true">🏆</span>
                    <div>
                      {page.section_title && (
                        <p className="text-sm font-semibold text-panoply-navy">
                          {page.section_title}
                        </p>
                      )}
                      <p className="text-sm text-panoply-gray-3">{page.prize_description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* About the creator */}
          {creator && (creator.display_name || creator.bio) && (
            <Section title="About the creator">
              <div className="flex items-start gap-4 rounded-panel border border-panoply-gray-2 bg-panoply-gray-1 p-4">
                {creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name ?? 'Creator'}
                    className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-panoply-gray-2"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-panoply-teal text-white text-base font-semibold select-none">
                    {(creator.display_name ?? '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-panoply-navy">
                    {creator.display_name ?? 'Unknown creator'}
                  </p>
                  {creator.bio && (
                    <p className="mt-1 text-sm text-panoply-gray-3 leading-relaxed line-clamp-4">
                      {creator.bio}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Bottom CTAs */}
          <div
            className={cn(
              'flex flex-col gap-3 border-t border-panoply-gray-2 pt-6',
              'sm:flex-row sm:items-center',
            )}
          >
            <Link
              href={`/stops?passport=${passport.id}`}
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center rounded-panel px-6 text-sm font-semibold',
                'border border-panoply-gray-2 text-panoply-navy hover:border-panoply-teal hover:text-panoply-teal-dk',
                'transition-colors',
                !hasSharedStops && 'pointer-events-none opacity-40',
              )}
              aria-disabled={!hasSharedStops}
            >
              {hasSharedStops ? 'Import a stop' : 'No shared stops'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
