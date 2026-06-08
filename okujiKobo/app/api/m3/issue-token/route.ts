import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/m3/issue-token
 *
 * Thin wrapper around the SECURITY DEFINER issue_stop_qr_token
 * function (migration 021). Returns a freshly-generated single-
 * use stop QR token whose lifetime is bounded by p_ttl_seconds.
 *
 * Caller auth: any authenticated user. The function itself
 * enforces creator / can_verify / can_distribute_prizes / platform-
 * admin authorization.
 *
 * Body: { stop_id: string, ttl_seconds?: number }
 *   ttl_seconds defaults to 300 (5 minutes). Range: 1..86400.
 *
 * Response: { token: string, generated: true } on success.
 *
 * This route is the minimal "terminal affordance for testing"
 * permitted by the M3 scope — full merchant token-issue UI is M4.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.stop_id !== 'string') {
    return NextResponse.json({ error: 'stop_id is required' }, { status: 400 })
  }
  const ttlSeconds: number = typeof body.ttl_seconds === 'number' && Number.isFinite(body.ttl_seconds)
    ? body.ttl_seconds
    : 300

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('issue_stop_qr_token', {
    p_stop_id: body.stop_id,
    p_ttl_seconds: ttlSeconds,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'Token issue failed' },
      // The function raises with ERRCODE 42501 for auth, 22023 for
      // bad input, P0002 for missing stop. Map to HTTP coarsely.
      { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 },
    )
  }

  return NextResponse.json({ token: data, generated: true })
}
