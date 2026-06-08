import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/cn'
import { passportTypeIcon } from '@/lib/design/passport-type-icon'
import { PassportViewer } from '@/components/explore/PassportViewer'
import type { ViewerPage } from '@/components/explore/PageView'
import type { ViewerCover } from '@/components/explore/CoverFrontView'
import type { DesignerPageElement } from '@/lib/design/types'
import { DownloadFreePdfButton } from '@/components/explore/DownloadFreePdfButton'

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
  // Pre-rendered images written by lib/explore/publish-images at the
  // last publish/republish. Null when the passport hasn't been
  // republished since the image pipeline shipped — the viewer falls
  // back to live-render in that case so existing passports still work.
  cover_image_url: string | null
  page_image_urls: string[] | null
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
  // M2 leak guard (migration 069): also filter distribution_only
  // here so a guessed/shared URL for a consumable can't leak the
  // passport title via Open Graph metadata. Holders read the
  // passport through the marketplace detail page (which has the
  // holder branch); Explore is a public-discovery surface.
  const { data } = await supabase
    .from('passports')
    .select('title, description')
    .eq('id', id)
    .eq('is_published', true)
    .eq('distribution_only', false)
    .single()

  if (!data) return { title: 'Passport · okujiKobo' }
  return {
    title: `${(data as { title: string }).title} · Explore · okujiKobo`,
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
      <h2 className="text-base font-semibold text-navy">{title}</h2>
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

  // Auth status — Explore detail is viewable logged-out, but the
  // free-PDF download button only renders for logged-in users. The
  // print-pdf route also independently requires auth + the
  // published+free conditions before returning bytes.
  const { data: { user: viewer } } = await supabase.auth.getUser()

  // ── Fetch passport (simple select, no profile join to avoid RLS issues) ────
  const { data: passportRaw, error: passportError } = await supabase
    .from('passports')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    // M2 leak guard (migration 069). Explore is public-discovery
    // only — consumables are never listed here. Holders reach
    // their consumable via the marketplace detail page or their
    // library, where the holder-acquired branch (migration 062)
    // permits the read.
    .eq('distribution_only', false)
    .single()

  if (passportError || !passportRaw) {
    notFound()
  }

  const passport = passportRaw as unknown as PassportRow

  // ── Fetch pages + stops separately ────────────────────────────────────────
  // Pull every visual / layout field the viewer renders. Cheap — published
  // passports are immutable until republish, so this query reflects the
  // canonical content.
  const { data: pagesRaw } = await supabase
    .from('passport_pages')
    .select(
      'id, page_order, page_type, section_title, section_name, section_subtitle, ' +
        'prize_description, prize_location_constraint, ' +
        'background_type, background_color, background_opacity, background_image_url, ' +
        'custom_background_opacity, paper_color, elements',
    )
    .eq('passport_id', id)
    .order('page_order', { ascending: true })

  const pageIds = (pagesRaw ?? []).map((p: { id: string }) => p.id)

  const { data: stopsRaw } =
    pageIds.length > 0
      ? await supabase
          .from('stops')
          .select(
            'id, name, stop_order, page_id, ' +
              'address_street, address_city, address_state, learning_objective, ' +
              'stamp_icon, stamp_color, classifiers, is_shared, ' +
              'box_x, box_y, box_width, box_height, rotation',
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

  // ── Assemble pages with stops (metadata view) ─────────────────────────────
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

  // ── Assemble viewer-shaped pages (with full layout + visual fields) ──────
  // Stamp pages drive the spread renderer; information pages also flow
  // through (page.page_type carries through to PageBackground / stop layer).
  const viewerPages: ViewerPage[] = (pagesRaw ?? []).map((p) => {
    const r = p as Record<string, unknown>
    const pageId = r['id'] as string
    const stops = ((stopsRaw ?? []) as Array<Record<string, unknown>>)
      .filter((s) => s['page_id'] === pageId)
      .sort((a, b) => (a['stop_order'] as number) - (b['stop_order'] as number))
      .map((s) => ({
        id:           s['id']         as string,
        name:         s['name']       as string,
        box_x:        s['box_x']      as number | null,
        box_y:        s['box_y']      as number | null,
        box_width:    s['box_width']  as number | null,
        box_height:   s['box_height'] as number | null,
        rotation:     s['rotation']   as number | null,
        stamp_icon:   s['stamp_icon'] as string | null,
        stamp_color:  s['stamp_color'] as string | null,
      }))
    return {
      id:                         pageId,
      page_order:                 r['page_order']                 as number,
      page_type:                  (r['page_type'] as 'stamp' | 'information') ?? 'stamp',
      section_name:               r['section_name']               as string,
      section_title:              r['section_title']              as string | null,
      section_subtitle:           r['section_subtitle']           as string | null,
      prize_description:          r['prize_description']          as string | null,
      prize_location_constraint:  r['prize_location_constraint']  as string | null,
      background_type:            (r['background_type'] ?? 'none') as ViewerPage['background_type'],
      background_color:           r['background_color']           as string | null,
      background_opacity:         r['background_opacity']         as number | null,
      background_image_url:       r['background_image_url']       as string | null,
      custom_background_opacity:  r['custom_background_opacity']  as number | null,
      paper_color:                r['paper_color']                as string | null,
      elements:                   ((r['elements'] as DesignerPageElement[] | null) ?? []),
      stops,
    }
  })

  // ── Cover composition for the viewer's front-cover page ──────────────────
  // cover_outside_data carries the saved 1248×792 wrap (back | spine | front).
  // The viewer extracts the front (rightmost 612×792) via overflow clipping.
  const coverDataRaw = passport.cover_outside_data as Record<string, unknown> | null
  const viewerCover: ViewerCover | null = coverDataRaw
    ? {
        front_bg:         (coverDataRaw['front_bg']        as string | null) ?? null,
        back_bg:          (coverDataRaw['back_bg']         as string | null) ?? null,
        image_url:        (coverDataRaw['image_url']       as string | null) ?? null,
        image_opacity:    (coverDataRaw['image_opacity']   as number)        ?? 80,
        image_position_x: (coverDataRaw['image_position_x'] as number)       ?? 0.5,
        image_position_y: (coverDataRaw['image_position_y'] as number)       ?? 0.5,
        image_scale:      (coverDataRaw['image_scale']     as number)        ?? 1,
        elements:         ((coverDataRaw['elements'] as DesignerPageElement[] | null) ?? []),
      }
    : null

  const allStops = pages.flatMap((p) => p.stops)
  const prizePages = pages.filter((p) => p.prize_description)
  const hasSharedStops = allStops.some((s) => s.is_shared)

  const typeIcon = passportTypeIcon(passport.passport_type ?? null)

  return (
    <div className="min-h-screen bg-white">

      {/* ── Viewer — opens to the front cover, flips two pages at a time ──── */}
      {/* Prefers the pre-rendered cover + page images written at
          publish/republish; falls back to live-render with cover +
          page data when those URLs aren't set (pre-pipeline passports
          or a publish where the image step errored). */}
      <PassportViewer
        cover={viewerCover}
        pages={viewerPages}
        fallbackBg={passport.cover_bg_color}
        emblem={passport.cover_emblem}
        title={passport.title}
        coverImageUrl={passport.cover_image_url}
        pageImageUrls={passport.page_image_urls}
      />

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

        {/* Back link */}
        <Link
          href="/explore"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-navy transition-colors"
        >
          ← Back to Explore
        </Link>

        {/* Title + author */}
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-tight" aria-hidden="true">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-navy leading-tight">
              {passport.title}
            </h1>
            {creator?.display_name && (
              <p className="mt-1 text-sm text-muted">
                by{' '}
                <span className="font-medium text-navy">
                  {creator.display_name}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Badge row */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {passport.expected_spend_tier && SPEND_TIER_LABELS[passport.expected_spend_tier] && (
            <span className="rounded-full border border-hairline px-2.5 py-1 text-muted">
              {SPEND_TIER_LABELS[passport.expected_spend_tier]} on the ground
            </span>
          )}
          {passport.is_free && (
            <span className="rounded-full bg-cream px-2.5 py-1 font-medium text-green">
              Free passport
            </span>
          )}
          {passport.transit_accessible && (
            <span className="rounded-full border border-hairline px-2.5 py-1 text-muted">
              🚌 Transit friendly
            </span>
          )}
          {passport.wheelchair_accessible && (
            <span className="rounded-full border border-hairline px-2.5 py-1 text-muted">
              ♿ Wheelchair accessible
            </span>
          )}
          {passport.passport_type && (
            <span className="rounded-full border border-hairline px-2.5 py-1 text-muted capitalize">
              {passport.passport_type}
            </span>
          )}
        </div>

        {/* Stats row */}
        {(pages.length > 0 || allStops.length > 0) && (
          <p className="mt-3 text-sm text-muted">
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

        <hr className="my-6 border-hairline" />

        <div className="space-y-8">

          {/* Description */}
          {passport.description && (
            <Section title="About">
              <p className="text-sm leading-relaxed text-muted whitespace-pre-line">
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
                        className="flex items-start gap-3 rounded-card border border-hairline bg-paper px-4 py-3"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green text-white text-xs font-semibold">
                          {globalIdx}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy">{stop.name}</p>
                          {(stop.address_street || stop.address_city) && (
                            <p className="mt-0.5 text-xs text-muted">
                              {[stop.address_street, stop.address_city, stop.address_state]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                          {stop.learning_objective && (
                            <p className="mt-0.5 text-xs italic text-muted">
                              {stop.learning_objective}
                            </p>
                          )}
                          {(stop.classifiers ?? []).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(stop.classifiers ?? []).slice(0, 3).map((c) => (
                                <span
                                  key={c}
                                  className="rounded-card bg-cream px-1.5 py-0.5 text-[10px] font-medium text-green capitalize"
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
                    className="flex items-start gap-3 rounded-panel border border-accent bg-amber-50 px-4 py-3"
                  >
                    <span className="text-xl" aria-hidden="true">🏆</span>
                    <div>
                      {page.section_title && (
                        <p className="text-sm font-semibold text-navy">
                          {page.section_title}
                        </p>
                      )}
                      <p className="text-sm text-muted">{page.prize_description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* About the creator */}
          {creator && (creator.display_name || creator.bio) && (
            <Section title="About the creator">
              <div className="flex items-start gap-4 rounded-panel border border-hairline bg-paper p-4">
                {creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creator.avatar_url}
                    alt={creator.display_name ?? 'Creator'}
                    className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-hairline"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green text-white text-base font-semibold select-none">
                    {(creator.display_name ?? '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">
                    {creator.display_name ?? 'Unknown creator'}
                  </p>
                  {creator.bio && (
                    <p className="mt-1 text-sm text-muted leading-relaxed line-clamp-4">
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
              'flex flex-col gap-3 border-t border-hairline pt-6',
              'sm:flex-row sm:items-center',
            )}
          >
            {/* Download printable PDF — published + FREE passports only,
                logged-in viewers only. Paid passports show no download
                button (the PDF is part of what's paid for). The
                print-pdf route enforces these conditions independently
                so this UI is a surface, not a gate. */}
            {viewer && passport.is_published && (passport.price_cents ?? 0) === 0 && (
              <DownloadFreePdfButton
                passportId={passport.id}
                title={passport.title}
              />
            )}
            <Link
              href={`/stops?passport=${passport.id}`}
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center rounded-panel px-6 text-sm font-semibold',
                'border border-hairline text-navy hover:border-green hover:text-green',
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
