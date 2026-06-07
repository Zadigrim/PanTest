import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'
import { getPageUsage, getTrialUsage } from '@/lib/trial/limits'

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

  // Default page_order = current count (server-side authoritative;
  // matches what LeftPalette computed locally before this route
  // existed). page_order is mutable via the debounced UPDATE path.
  const nextOrder = pageUsage.pagesUsed
  const sectionName: string = typeof body.section_name === 'string' && body.section_name
    ? body.section_name
    : `Section ${nextOrder + 1}`

  const insertRow: Record<string, unknown> = {
    passport_id:        passportId,
    page_order:         nextOrder,
    section_name:       sectionName,
    background_type:    body.background_type    ?? 'guilloche',
    background_color:   body.background_color   ?? '0D1B2A',
    paper_color:        body.paper_color        ?? 'F5F2EC',
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
