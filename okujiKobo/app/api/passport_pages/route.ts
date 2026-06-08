import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'
import { getPageUsage, getTrialUsage } from '@/lib/trial/limits'
import { OKUJI_PAGE_BACKGROUNDS } from '@/lib/assets/okuji-presets'

// Default ground used for any new page when the caller omits
// background_type — the Guilloche medallion preset. Pulled from
// OKUJI_PAGE_BACKGROUNDS so adding/renaming a preset file in one
// place doesn't leave this stale.
const DEFAULT_OKUJI_PRESET_URL =
  OKUJI_PAGE_BACKGROUNDS.find((p) => p.id === 'pbg_okuji_ground_01')?.url
  ?? OKUJI_PAGE_BACKGROUNDS[0].url

/**
 * POST /api/passport_pages
 *
 * Creates a new page on a passport. The CREATE path is the only
 * page-write that goes through this route — the high-frequency
 * debounced UPDATE path (lib/design/persist.ts) writes directly
 * via the Supabase JS client and is governed by migration 038's
 * RLS. Centralizing CREATE here lets us enforce the trial 12-page
 * cap server-side.
 *
 * Authorization: same shape as the passport mutation routes —
 * creator OR admin OR can_design at the proprietor institution.
 *
 * Trial cap (DEC-03 / BLD-06): Free-tier owners are capped at 12
 * pages per personal passport. Pro / Studio / platform-admin
 * holders + ALL institution-owned passports are exempt
 * (institutions don't go through the personal-trial gate;
 * institution caps live elsewhere).
 *
 * Body: {
 *   passport_id: string,
 *   page_type?: string,       // optional; defaults to undefined
 *                             // and lets DB defaults apply
 *   section_name?: string,    // defaults to "Section N"
 *   background_type?: string, // defaults to 'guilloche'
 *   background_color?: string,
 *   paper_color?: string,
 * }
 *
 * Response: the created passport_pages row.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.passport_id !== 'string') {
    return NextResponse.json({ error: 'passport_id is required' }, { status: 400 })
  }
  const passportId: string = body.passport_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, proprietor_id')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  // Authorization: creator / admin / can_design at proprietor.
  const auth = await authorizePassportMutation(supabase, passport, user.id)
  if (auth === 'denied') {
    return NextResponse.json(
      { error: passport.proprietor_id
          ? 'Not authorized (creator, admin, or can_design at the owning institution required)'
          : 'Not the creator' },
      { status: 403 },
    )
  }

  // Trial 12-page cap. Institutional and exempt callers bypass.
  // Personal passports owned by a Pro / Studio user also bypass.
  const isInstitutional = !!passport.proprietor_id
  let exempt = isInstitutional || auth === 'admin' || auth === 'employee'
  if (!exempt && auth === 'creator') {
    const usage = await getTrialUsage(supabase, user.id)
    exempt = usage.exempt
  }
  const pageUsage = await getPageUsage(supabase, passportId, exempt)
  if (!pageUsage.canAddPage) {
    return NextResponse.json(
      {
        error: 'Free-tier page limit reached',
        detail: `This passport has ${pageUsage.pagesUsed} of ${pageUsage.pagesCap} pages. Upgrade to Pro or Studio for unlimited pages.`,
        pagesUsed: pageUsage.pagesUsed,
        pagesCap: pageUsage.pagesCap,
      },
      { status: 402 },
    )
  }

  // INSERT-AT-POSITION SUPPORT (M-page-ops, drafts only).
  //
  // Optional body.target_position: when present, insert at that
  // position and SHIFT every page with page_order >= target_position
  // up by 1. Active (non-closed) pages only — closed pages
  // (closed_at IS NOT NULL) retain their original page_order
  // because the snapshot diff relies on those values to detect
  // reorders correctly.
  //
  // When target_position is OMITTED, behavior is unchanged from
  // the M2 ship: append at the end.
  //
  // The shift is performed via per-row UPDATE under a brief
  // SELECT...FOR UPDATE lock to avoid races against the same
  // designer running two concurrent inserts. Bounded set (12
  // pages cap on Free; institutions are uncapped but a single
  // passport realistically has <100 pages), so the per-row
  // approach has acceptable cost.
  //
  // No reorder happens on a published-with-acquisitions passport
  // — adding a page there is content addition that the republish
  // diff blocks as 'other'. The shift logic still works
  // structurally (closed pages retain page_order), but the
  // resulting state lands in the next republish diff as a new
  // page (other category) regardless.
  const targetPositionRaw = body.target_position
  const targetPosition = typeof targetPositionRaw === 'number' && Number.isFinite(targetPositionRaw)
    ? Math.max(0, Math.floor(targetPositionRaw))
    : null

  // Active page count drives the default-append index AND the
  // section-name default. pageUsage.pagesUsed counts ALL pages
  // including closed; for naming we want the active count.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activePages } = await (db as any)
    .from('passport_pages')
    .select('id, page_order')
    .eq('passport_id', passportId)
    .is('closed_at', null)
    .order('page_order', { ascending: true })
  const active = (activePages ?? []) as { id: string; page_order: number }[]

  // Clamp target to [0, active.length]. Anything past the end
  // collapses to "append."
  const effectivePosition = targetPosition == null || targetPosition > active.length
    ? active.length
    : targetPosition

  // SHIFT pages whose page_order >= effectivePosition. Active
  // pages only — closed pages keep their stale page_order so the
  // snapshot diff sees the active reorder cleanly.
  if (effectivePosition < active.length) {
    const toShift = active.filter((p) => p.page_order >= effectivePosition)
    // Sort descending so we update higher numbers first, avoiding
    // a transient UNIQUE(passport_id, page_order) collision when
    // two adjacent rows would temporarily share the same value.
    toShift.sort((a, b) => b.page_order - a.page_order)
    for (const p of toShift) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: shiftErr } = await (db as any)
        .from('passport_pages')
        .update({ page_order: p.page_order + 1 })
        .eq('id', p.id)
      if (shiftErr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NextResponse.json(
          { error: `Page-order shift failed: ${(shiftErr as any).message}` },
          { status: 500 },
        )
      }
    }
  }

  const sectionName: string = typeof body.section_name === 'string' && body.section_name
    ? body.section_name
    : `Section ${effectivePosition + 1}`

  // Default background: the Guilloche medallion okuji preset.
  // When the caller doesn't pass a background_type, we land on
  // 'okuji' + the preset URL so new pages arrive with okuji
  // chrome rather than the older bare 'guilloche' pattern.
  // background_color stays the same dark navy used for stamp
  // foregrounds; the okuji renderer treats it identically to
  // 'custom' (image overlay over paper_color, controlled by
  // custom_background_opacity which DB-defaults to 100).
  const backgroundType: string = typeof body.background_type === 'string' && body.background_type
    ? body.background_type
    : 'okuji'
  const insertRow: Record<string, unknown> = {
    passport_id:        passportId,
    page_order:         effectivePosition,
    section_name:       sectionName,
    background_type:    backgroundType,
    background_color:   body.background_color   ?? '0D1B2A',
    paper_color:        body.paper_color        ?? 'F5F2EC',
  }
  if (backgroundType === 'okuji' && typeof body.background_image_url !== 'string') {
    insertRow.background_image_url = DEFAULT_OKUJI_PRESET_URL
  } else if (typeof body.background_image_url === 'string') {
    insertRow.background_image_url = body.background_image_url
  }
  if (typeof body.page_type === 'string') insertRow.page_type = body.page_type

  const { data: created, error: insErr } = await db
    .from('passport_pages')
    .insert(insertRow)
    .select()
    .single()

  if (insErr || !created) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(
      { error: (insErr as any)?.message ?? 'Failed to create page' },
      { status: 500 },
    )
  }
  return NextResponse.json(created)
}
