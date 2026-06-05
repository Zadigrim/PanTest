import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * /api/stops/:id/acknowledge — kudos toggle.
 *
 *   POST   → insert a (stop_id, user_id) row. Returns 200 on
 *            success OR if the row already existed (idempotent).
 *   DELETE → remove the (stop_id, user_id) row. Returns 200 on
 *            success OR if nothing was there (idempotent).
 *
 * The stop must be shared — the migration's RLS WITH CHECK
 * enforces it on INSERT; the route returns 404 here so the UI
 * gets a clear error instead of an opaque RLS rejection.
 *
 * Counts (for the card footer + drawer stat) are NOT returned
 * by this endpoint — callers refresh by re-fetching the page
 * data. Keeping the endpoint thin avoids "you've now got N+1
 * kudos" races between concurrent toggles.
 */
async function ensureAuthAndStop(
  request: NextRequest,
  id: string,
): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; status: number; body: { error: string } }
> {
  void request
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } }
  }
  // Verify the stop exists AND is shared. Same predicate the
  // RLS check uses; surfacing it here lets us return 404 rather
  // than a generic 403 on insert.
  const { data: stop, error: stopErr } = await supabase
    .from('stops')
    .select('id, is_shared')
    .eq('id', id)
    .single()
  if (stopErr || !stop) {
    return { ok: false, status: 404, body: { error: 'Stop not found' } }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(stop as any).is_shared) {
    return { ok: false, status: 404, body: { error: 'Stop is not shared' } }
  }
  return { ok: true, supabase, userId: user.id }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const guard = await ensureAuthAndStop(request, id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (guard.supabase as any)
    .from('stop_acknowledgments')
    .insert({ stop_id: id, user_id: guard.userId })
  // 23505 = unique_violation. Idempotent: if the row exists
  // already, the toggle is a no-op for INSERT.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (insErr && (insErr as any).code !== '23505') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (insErr as any).message ?? 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ acknowledged: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const guard = await ensureAuthAndStop(request, id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (guard.supabase as any)
    .from('stop_acknowledgments')
    .delete()
    .eq('stop_id', id)
    .eq('user_id', guard.userId)
  if (delErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (delErr as any).message ?? 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ acknowledged: false })
}
