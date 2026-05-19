import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stops/import
 *
 * Imports a shared stop from the library into a target passport.
 * Body: { stopId: string; passportId: string }
 *
 * Steps:
 * 1. Verify auth
 * 2. Fetch source stop (must be is_shared = true)
 * 3. Fetch creator name + institution name for attribution
 * 4. Ensure target passport belongs to the current user
 * 5. Resolve or create a passport page on the target passport
 * 6. Insert the new stop copy
 * 7. Return { success: true, stopId, passportId }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { stopId?: string; passportId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { stopId, passportId } = body

  if (!stopId || !passportId) {
    return NextResponse.json(
      { error: 'stopId and passportId are required' },
      { status: 400 },
    )
  }

  // ── Fetch source stop (must be shared) ────────────────────────────────────
  const { data: sourceStop, error: stopErr } = await supabase
    .from('stops')
    .select(
      `
      id,
      name,
      stamp_icon,
      address_street,
      address_city,
      address_state,
      address_zip,
      address_country,
      latitude,
      longitude,
      classifiers,
      learning_objective,
      journal_prompt,
      grade_levels,
      subject_areas,
      creator_id,
      profiles:creator_id ( display_name ),
      page_id,
      passport_pages!page_id (
        passports (
          institutions:proprietor_id ( name )
        )
      )
    `,
    )
    .eq('id', stopId)
    .eq('is_shared', true)
    .single()

  if (stopErr || !sourceStop) {
    return NextResponse.json(
      { error: 'Stop not found or not available for import' },
      { status: 404 },
    )
  }

  // ── Verify passport belongs to current user ───────────────────────────────
  const { data: targetPassport, error: passportErr } = await supabase
    .from('passports')
    .select('id, title')
    .eq('id', passportId)
    .eq('creator_id', user.id)
    .single()

  if (passportErr || !targetPassport) {
    return NextResponse.json(
      { error: 'Passport not found or access denied' },
      { status: 403 },
    )
  }

  // ── Build attribution note ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const src = sourceStop as any
  const creatorName: string | null = src.profiles?.display_name ?? null
  const institutionName: string | null =
    src.passport_pages?.passports?.institutions?.name ?? null

  const attributionParts: string[] = []
  if (creatorName) attributionParts.push(creatorName)
  if (institutionName) attributionParts.push(institutionName)

  const attributionNote =
    attributionParts.length > 0
      ? `Based on a stop by ${attributionParts.join(' at ')}`
      : 'Based on a community stop from the Okuji library'

  // ── Resolve target page (first page, or create one) ───────────────────────
  const { data: existingPages } = await supabase
    .from('passport_pages')
    .select('id, page_order')
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true })
    .limit(1)

  let targetPageId: string

  if (existingPages && existingPages.length > 0) {
    targetPageId = existingPages[0].id
  } else {
    // Create a first page
    const { data: newPage, error: pageErr } = await supabase
      .from('passport_pages')
      .insert({
        passport_id: passportId,
        page_order: 0,
        title: targetPassport.title,
      })
      .select('id')
      .single()

    if (pageErr || !newPage) {
      return NextResponse.json(
        { error: pageErr?.message ?? 'Failed to create passport page' },
        { status: 500 },
      )
    }

    targetPageId = newPage.id
  }

  // ── Count existing stops on target page (for stop_order) ─────────────────
  const { count: existingStopsCount } = await supabase
    .from('stops')
    .select('id', { count: 'exact', head: true })
    .eq('page_id', targetPageId)

  const newStopOrder = existingStopsCount ?? 0

  // ── Insert the copied stop ────────────────────────────────────────────────
  const { data: newStop, error: insertErr } = await supabase
    .from('stops')
    .insert({
      page_id: targetPageId,
      creator_id: user.id,
      name: src.name,
      stamp_icon: src.stamp_icon ?? null,
      address_street: src.address_street ?? null,
      address_city: src.address_city ?? null,
      address_state: src.address_state ?? null,
      address_zip: src.address_zip ?? null,
      address_country: src.address_country ?? null,
      latitude: src.latitude ?? null,
      longitude: src.longitude ?? null,
      classifiers: src.classifiers ?? [],
      learning_objective: src.learning_objective ?? null,
      journal_prompt: src.journal_prompt ?? null,
      grade_levels: src.grade_levels ?? [],
      subject_areas: src.subject_areas ?? [],
      original_stop_id: sourceStop.id,
      attribution_note: attributionNote,
      is_shared: false,
      stop_order: newStopOrder,
    })
    .select('id')
    .single()

  if (insertErr || !newStop) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to import stop' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    stopId: newStop.id,
    passportId,
  })
}
