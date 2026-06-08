import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/m3/consume-token
 *
 * Thin wrapper around the SECURITY DEFINER
 * consume_stop_qr_token_and_punch function (migration 021). The
 * caller is the COLLECTOR — the function uses auth.uid() to
 * resolve the active card_instance.
 *
 * Body: { token: string, lat?: number, lng?: number, stop_opened_at?: string }
 *   lat/lng required only when the stop has a target_location AND
 *   verification_tier IN (1, 2, 3). The function refuses with
 *   ERRCODE 22023 if GPS is required and missing.
 *
 * Response: { punch: punches-row } on success.
 *   When the punch completes the card, a completion_token row was
 *   also inserted server-side (visible via the existing terminal
 *   flow); the response stays focused on the punch itself.
 *
 * This route is the minimal collector-side affordance for end-to-
 * end M3 testing. The mobile QR-scan UI is deferred to M4 per the
 * binary-impact scope guard.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }
  const lat: number | null = typeof body.lat === 'number' ? body.lat : null
  const lng: number | null = typeof body.lng === 'number' ? body.lng : null
  const stopOpenedAt: string = typeof body.stop_opened_at === 'string'
    ? body.stop_opened_at
    : new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('consume_stop_qr_token_and_punch', {
    p_token: body.token,
    p_lat: lat,
    p_lng: lng,
    p_stop_opened_at: stopOpenedAt,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'Punch failed' },
      { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400 },
    )
  }

  return NextResponse.json({ punch: data })
}
