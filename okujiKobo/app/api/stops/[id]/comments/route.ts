import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/stops/:id/comments
 *   Returns the full comment list for a shared stop, newest
 *   first, with author display name + institution attribution
 *   resolved server-side. Also returns the set of importer ids
 *   for this stop so the client can decorate any comment whose
 *   author has imported it with the "Used this in a passport"
 *   badge (derived live from stop_imports — never user-toggleable).
 *
 * POST /api/stops/:id/comments  body: { body: string }
 *   Inserts a new comment. RLS enforces the writer population
 *   (institutional members + admin) and the shared-stop check;
 *   this handler does basic length validation up-front for a
 *   clearer error than a constraint violation.
 *
 * Both endpoints require auth; non-shared stops 404.
 */

const MAX_BODY_LEN = 1000

async function guardStop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stopId: string,
): Promise<{ ok: true } | { ok: false; status: number; body: { error: string } }> {
  const { data: stop, error } = await supabase
    .from('stops')
    .select('id, is_shared')
    .eq('id', stopId)
    .single()
  if (error || !stop) return { ok: false, status: 404, body: { error: 'Stop not found' } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(stop as any).is_shared) return { ok: false, status: 404, body: { error: 'Stop is not shared' } }
  return { ok: true }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: stopId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const guard = await guardStop(supabase, stopId)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Flat fetch + hydrate. Same pattern the stops page now uses
  // (the nested embed bit us last time; not making that mistake
  // here on a brand-new table).
  const { data: cmtRows, error: cmtErr } = await db
    .from('stop_comments')
    .select('id, stop_id, author_id, body, created_at, edited_at')
    .eq('stop_id', stopId)
    .order('created_at', { ascending: false })
  if (cmtErr) {
    console.error('[stops/comments GET] fetch failed:', cmtErr.message)
    return NextResponse.json({ error: cmtErr.message }, { status: 500 })
  }
  const comments = (cmtRows ?? []) as Array<{
    id: string; stop_id: string; author_id: string
    body: string; created_at: string; edited_at: string | null
  }>

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id)))
  const [authorRes, instOwnedRes, instEmployeeRes, importsRes, adminRes] = await Promise.all([
    authorIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('profiles').select('id, display_name').in('id', authorIds),
    // Authors who ARE an institution (manager-pattern: institutions.id = user.id).
    authorIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('institutions').select('id, name').in('id', authorIds),
    // Authors who are EMPLOYEES — first EA row picks the institution.
    authorIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('employee_authorizations').select('user_id, institution_id').in('user_id', authorIds),
    // Used-this set: every importer of THIS stop.
    db.from('stop_imports').select('importer_id').eq('source_stop_id', stopId),
    // Is the current viewer a platform admin? Tells the client
    // to enable "delete any" buttons.
    db.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
  ])

  const displayNameById = new Map(
    ((authorRes.data ?? []) as { id: string; display_name: string | null }[])
      .map((r) => [r.id, r.display_name]),
  )
  const instNameByAuthorId = new Map<string, string | null>(
    ((instOwnedRes.data ?? []) as { id: string; name: string | null }[])
      .map((r) => [r.id, r.name]),
  )

  // For employee authors we need a second pass: the EA gives us
  // the institution_id; resolve names.
  const employeeRows = (instEmployeeRes.data ?? []) as { user_id: string; institution_id: string }[]
  const eaInstitutionIds = Array.from(new Set(employeeRows.map((r) => r.institution_id)))
  const { data: eaInstRows } = eaInstitutionIds.length === 0
    ? { data: [] }
    : await db.from('institutions').select('id, name').in('id', eaInstitutionIds)
  const nameByInstId = new Map(
    ((eaInstRows ?? []) as { id: string; name: string | null }[]).map((r) => [r.id, r.name]),
  )
  for (const ea of employeeRows) {
    if (!instNameByAuthorId.has(ea.user_id)) {
      instNameByAuthorId.set(ea.user_id, nameByInstId.get(ea.institution_id) ?? null)
    }
  }

  const importerIds = new Set(
    ((importsRes.data ?? []) as { importer_id: string }[]).map((r) => r.importer_id),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerIsAdmin = !!(adminRes.data as any)?.is_platform_admin

  return NextResponse.json({
    viewerId: user.id,
    viewerIsAdmin,
    comments: comments.map((c) => ({
      id: c.id,
      stop_id: c.stop_id,
      author_id: c.author_id,
      body: c.body,
      created_at: c.created_at,
      edited_at: c.edited_at,
      author_name: displayNameById.get(c.author_id) ?? null,
      author_institution_name: instNameByAuthorId.get(c.author_id) ?? null,
      used_this: importerIds.has(c.author_id),
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: stopId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (text.length === 0) return NextResponse.json({ error: 'Comment body required' }, { status: 400 })
  if (text.length > MAX_BODY_LEN) {
    return NextResponse.json({ error: `Comment exceeds ${MAX_BODY_LEN} characters` }, { status: 400 })
  }

  const guard = await guardStop(supabase, stopId)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // RLS enforces the writer-population predicate. We don't
  // pre-check the role here — the policy is the source of
  // truth, and a clean 403/RLS-rejection message is what the
  // UI surfaces inline if a non-writer tricked their way to
  // the endpoint (the compose box is hidden in the UI for
  // non-writers).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: insErr } = await (supabase as any)
    .from('stop_comments')
    .insert({ stop_id: stopId, author_id: user.id, body: text })
    .select('id, created_at')
    .single()
  if (insErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (insErr as any).message ?? 'Insert failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: row.id, created_at: row.created_at })
}
