import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/passports/:id/demo  { is_demo: boolean }
 *
 * Demo-PUBLISH a passport (or clear it). Admin-only: only a platform admin may
 * designate a passport as demo. A demo passport lets ANY holder stamp it
 * regardless of GPS (the verify-stamp edge function reads passports.is_demo
 * server-side and allows-but-records); the GPS bypass is a property of the
 * PASSPORT, not the user.
 *
 * Two layers of enforcement, both server-side:
 *   1. This route gates on is_platform_admin() and 403s otherwise.
 *   2. The DB trigger trg_guard_passports_is_demo (migration 105) rejects any
 *      non-admin change to is_demo even if a write reached the table another
 *      way — so the column can never be self-set by a passport creator.
 *
 * Mirrors the single-admin-check invariant (is_platform_admin RPC); no parallel
 * gate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const isDemo = (body as { is_demo?: unknown })?.is_demo === true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('passports')
    .update({ is_demo: isDemo })
    .eq('id', passportId)

  if (error) {
    console.error('[passports/demo] update failed:', error)
    return NextResponse.json({ error: error.message ?? 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ id: passportId, is_demo: isDemo })
}
