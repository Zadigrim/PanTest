import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PassportViewer } from '@/components/explore/PassportViewer'
import type { ViewerPage } from '@/components/explore/PageView'
import type { ViewerCover } from '@/components/explore/CoverFrontView'
import type { DesignerPageElement } from '@/lib/design/types'

export const metadata = { title: 'Inspect — okuji' }

/**
 * /access/inspect/[passportId] — admin-only read-only render of any
 * passport (published or draft, any creator).
 *
 * Gate: platform admins only. Non-admins are redirected to /access.
 *
 * Logging: when the caller is NOT the creator and has no can_design
 * employee row at the proprietor institution, INSERTs one row into
 * admin_inspection_log. Self-inspection / lawful-employee-inspection
 * is not audit-worthy and not logged.
 *
 * Read-only: the page renders via PassportViewer which is purely
 * presentational (no edit / publish / transfer / delete UI anywhere
 * in its component tree). Mutation routes server-side independently
 * gate on creator / can_design / admin, so a paste-the-URL admin
 * still gets blocked from writes by those gates (with the noted
 * pre-existing caveat that admin currently bypasses those gates too;
 * tightening admin-write RLS is a separate decision).
 */
export default async function InspectPage({
  params,
}: {
  params: Promise<{ passportId: string }>
}) {
  const { passportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/access/inspect')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: isAdmin } = await db.rpc('is_platform_admin')
  if (!isAdmin) redirect('/access')

  // Passport — any state. Admin RLS clause on passports lets the
  // SELECT through regardless of is_published / creator_id.
  const { data: passport } = await db
    .from('passports')
    .select('*')
    .eq('id', passportId)
    .maybeSingle()

  if (!passport) notFound()

  // Pages — ALL of them including closed (closed_at IS NOT NULL).
  // For content-safety inspection, closure status doesn't change
  // whether the content needs review.
  const { data: pagesRaw } = await db
    .from('passport_pages')
    .select(
      'id, page_order, page_type, section_title, section_name, section_subtitle, ' +
        'prize_description, prize_location_constraint, ' +
        'background_type, background_color, background_opacity, background_image_url, ' +
        'custom_background_opacity, paper_color, elements, closed_at',
    )
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true })

  const pageIds = ((pagesRaw ?? []) as { id: string }[]).map((p) => p.id)
  const { data: stopsRaw } =
    pageIds.length > 0
      ? await db
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

  // Creator info + employee-can_design check — both feed the
  // "should we log?" decision.
  const { data: creator } = await db
    .from('profiles')
    .select('id, display_name, email, is_platform_admin')
    .eq('id', passport.creator_id)
    .maybeSingle()

  const isSelf = passport.creator_id === user.id

  let hasEmployeeAccess = false
  if (!isSelf && passport.proprietor_id) {
    const { data: authz } = await db
      .from('employee_authorizations')
      .select('can_design')
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
      .maybeSingle()
    hasEmployeeAccess = (authz?.can_design ?? false) === true
  }

  // Log only when this is a genuinely exceptional access — admin
  // looking at content they don't lawfully own through creator/
  // institutional channels. Fire-and-forget; a logging failure
  // doesn't block the page (degraded → unlogged, never broken).
  if (!isSelf && !hasEmployeeAccess) {
    try {
      await db.from('admin_inspection_log').insert({
        passport_id: passportId,
        passport_creator_id: passport.creator_id,
        inspected_by: user.id,
      })
    } catch (err) {
      console.error('[access/inspect] log INSERT failed', err)
    }
  }

  // ── Build viewer-shaped pages ────────────────────────────────
  const viewerPages: ViewerPage[] = ((pagesRaw ?? []) as Array<Record<string, unknown>>).map((p) => {
    const pageId = p['id'] as string
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
      page_order:                 p['page_order'] as number,
      page_type:                  (p['page_type'] as 'stamp' | 'information') ?? 'stamp',
      section_name:               p['section_name'] as string,
      section_title:              p['section_title'] as string | null,
      section_subtitle:           p['section_subtitle'] as string | null,
      prize_description:          p['prize_description'] as string | null,
      prize_location_constraint:  p['prize_location_constraint'] as string | null,
      background_type:            (p['background_type'] ?? 'none') as ViewerPage['background_type'],
      background_color:           p['background_color'] as string | null,
      background_opacity:         p['background_opacity'] as number | null,
      background_image_url:       p['background_image_url'] as string | null,
      custom_background_opacity:  p['custom_background_opacity'] as number | null,
      paper_color:                p['paper_color'] as string | null,
      elements:                   ((p['elements'] as DesignerPageElement[] | null) ?? []),
      stops,
    }
  })

  // ── Cover composition ────────────────────────────────────────
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

  // Aggregate counts only — CLAUDE.md #7. Per-holder identity is
  // never surfaced on this view; counts and timestamps are.
  const [{ count: acqCount }, { count: cpCount }, { count: pageCount }, { count: stopCount }] = await Promise.all([
    db.from('acquisitions').select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    db.from('collector_passports').select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    db.from('passport_pages').select('id', { count: 'exact', head: true }).eq('passport_id', passportId),
    pageIds.length > 0
      ? db.from('stops').select('id', { count: 'exact', head: true }).in('page_id', pageIds)
      : Promise.resolve({ count: 0 }),
  ])

  const closedPageCount = ((pagesRaw ?? []) as { closed_at: string | null }[])
    .filter((p) => p.closed_at != null).length

  return (
    <main className="min-h-screen bg-white">
      {/* Inspection banner — always present so the admin and any
          screen recording / over-the-shoulder reviewer see exactly
          what surface this is. */}
      <div className="border-b-2 border-accent bg-accent/5 px-6 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[3px] text-accent">
              Admin · Inspection (read-only)
            </p>
            <p className="mt-0.5 text-ink">
              <span className="font-semibold">{passport.title ?? 'Untitled'}</span>
              <span className="ml-2 text-xs text-muted">
                {passport.is_published ? 'Published' : 'Draft'}
                {' · '}
                Creator: {creator?.display_name ?? creator?.email ?? passport.creator_id.slice(0, 8)}
                {isSelf && ' (you)'}
                {hasEmployeeAccess && !isSelf && ' (your institution)'}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {pageCount ?? 0} page{pageCount === 1 ? '' : 's'}
              {closedPageCount > 0 && ` (${closedPageCount} closed)`}
              {' · '}{stopCount ?? 0} stop{stopCount === 1 ? '' : 's'}
              {' · '}{acqCount ?? 0} acquisition{acqCount === 1 ? '' : 's'}
              {' · '}{cpCount ?? 0} holder{cpCount === 1 ? '' : 's'}
              {!isSelf && !hasEmployeeAccess && ' · this access has been logged'}
            </p>
          </div>
          <Link
            href="/access/inspect"
            className="rounded-card border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
          >
            ← Inspect another
          </Link>
        </div>
      </div>

      <div className="px-6 py-8">
        <PassportViewer
          cover={viewerCover}
          pages={viewerPages}
          fallbackBg={passport.cover_bg_color}
          emblem={passport.cover_emblem}
          title={passport.title ?? 'Untitled'}
          coverImageUrl={passport.cover_image_url ?? null}
          pageImageUrls={passport.page_image_urls ?? null}
        />
      </div>
    </main>
  )
}
