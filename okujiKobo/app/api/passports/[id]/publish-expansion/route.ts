import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { authorizePassportMutation } from '@/lib/roles/require-flag'
import { readLatestSnapshot, captureLiveSnapshot } from '@/lib/design/republish/snapshot'
import type { Database } from '@/lib/supabase/types'

/**
 * POST /api/passports/:id/publish-expansion
 *
 * Publishes an EXPANSION: tags the pages the creator added since the last
 * publish with a new passport_expansions row, so they become opt-in
 * supplemental content (holders render them only after accepting). This is a
 * distinct ADDITIVE path — NOT the correction republish (which blocks new
 * pages). It never touches existing stamps/journal/progress and never
 * recomputes the original completion (migration 100 scopes completion to base
 * pages, expansion_id IS NULL).
 *
 * New pages are identified as base-scope (expansion_id NULL) pages absent from
 * the latest snapshot. We then re-snapshot so a later CORRECTION republish
 * sees the expansion pages as known (by id) and isn't blocked by them.
 *
 * Permission: creator / admin / can_design at the proprietor institution
 * (same gate as unpublish/republish). Writes via service role (snapshots +
 * passport_expansions are RLS-restricted); the passport stays published.
 */
function serviceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: passport, error: pErr } = await db
    .from('passports')
    .select('id, creator_id, proprietor_id, is_published')
    .eq('id', passportId)
    .single()
  if (pErr || !passport) return NextResponse.json({ error: 'Passport not found' }, { status: 404 })

  const auth = await authorizePassportMutation(supabase, passport, user.id)
  if (auth === 'denied') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!passport.is_published) {
    return NextResponse.json(
      { error: 'Publish the passport before adding an expansion.' },
      { status: 409 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = serviceClient() as any

  const snap = await readLatestSnapshot(svc, passportId)
  if (!snap) {
    return NextResponse.json({ error: 'No published snapshot found for this passport.' }, { status: 409 })
  }
  const knownIds = new Set(snap.pages.map((p) => p.id))

  // New = base-scope pages (expansion_id NULL) not present at last publish.
  const { data: curPages } = await svc
    .from('passport_pages')
    .select('id, page_order')
    .eq('passport_id', passportId)
    .is('expansion_id', null)
    .order('page_order', { ascending: true })
  const newPages = ((curPages ?? []) as { id: string }[]).filter((p) => !knownIds.has(p.id))
  if (newPages.length === 0) {
    return NextResponse.json(
      { error: 'No new pages to publish as an expansion. Add pages first, then publish the expansion.' },
      { status: 400 },
    )
  }

  const { data: maxRow } = await svc
    .from('passport_expansions')
    .select('sequence')
    .eq('passport_id', passportId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sequence = ((maxRow?.sequence as number | undefined) ?? 0) + 1

  const { data: exp, error: expErr } = await svc
    .from('passport_expansions')
    .insert({ passport_id: passportId, sequence, title, published_by: user.id })
    .select('id')
    .single()
  if (expErr || !exp) {
    return NextResponse.json({ error: expErr?.message ?? 'Could not create the expansion.' }, { status: 500 })
  }

  const newIds = newPages.map((p) => p.id)
  const { error: tagErr } = await svc
    .from('passport_pages')
    .update({ expansion_id: exp.id })
    .in('id', newIds)
  if (tagErr) {
    return NextResponse.json({ error: `Expansion created but tagging pages failed: ${tagErr.message}` }, { status: 500 })
  }

  // Re-snapshot so a later correction republish treats these pages as known.
  try {
    const snapshot = await captureLiveSnapshot(svc, passportId)
    await svc.from('passport_published_snapshots').insert({
      passport_id: passportId,
      published_by: user.id,
      snapshot,
    })
  } catch (e) {
    // Snapshot is the diff baseline; tagging already succeeded so the
    // expansion is live. Surface but don't fail the publish.
    console.error('[publish-expansion] snapshot capture failed', e)
  }

  return NextResponse.json({ ok: true, expansionId: exp.id, sequence, pageCount: newIds.length }, { status: 201 })
}
