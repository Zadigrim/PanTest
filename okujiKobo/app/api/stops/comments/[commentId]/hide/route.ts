import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST   /api/stops/comments/:commentId/hide    body: { hidden: boolean }
 *
 * Admin-only. Sets hidden_at = now() + hidden_by = caller when
 * hidden=true; clears both when hidden=false. Idempotent. The
 * underlying SECURITY DEFINER function enforces the admin check;
 * we add a route-level auth check too for a friendly 401 instead
 * of a generic Postgres error on unauthenticated callers.
 *
 * Single mechanism per CLAUDE.md invariant #4 — the function calls
 * profiles.is_platform_admin directly; no parallel moderation
 * role.
 *
 * Response: { hidden_at } (null when unhidden).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
): Promise<NextResponse> {
  const { commentId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.hidden !== 'boolean') {
    return NextResponse.json({ error: 'hidden (boolean) is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('set_stop_comment_hidden', {
    p_comment_id: commentId,
    p_hidden:     body.hidden,
  })
  if (error) {
    const code = (error as { code?: string }).code
    const status = code === 'insufficient_privilege' ? 403
                 : code === 'no_data_found'          ? 404
                 : 500
    return NextResponse.json({ error: error.message ?? 'Moderation failed' }, { status })
  }
  return NextResponse.json({ ok: true, hidden_at: data })
}
