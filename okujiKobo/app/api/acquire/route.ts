import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface AcquireBody {
  passportId: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: AcquireBody
  try {
    body = (await request.json()) as AcquireBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { passportId } = body
  if (!passportId) {
    return NextResponse.json({ error: 'passportId is required' }, { status: 400 })
  }

  // Fetch passport — must be published and free
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, is_published, is_free')
    .eq('id', passportId)
    .single()

  if (passportError || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  if (!passport.is_published) {
    return NextResponse.json({ error: 'Passport is not published' }, { status: 403 })
  }

  if (!passport.is_free) {
    return NextResponse.json(
      { error: 'Passport is not free — use checkout instead' },
      { status: 403 },
    )
  }

  // Insert acquisition (the purchase-event record)
  const { data: acquisition, error: insertError } = await supabase
    .from('acquisitions')
    .insert({
      user_id: user.id,
      passport_id: passportId,
      price_paid_cents: 0,
    })
    .select('id')
    .single()

  if (insertError) {
    // Postgres UNIQUE violation code: 23505
    if (insertError.code === '23505') {
      // Already-owned path still mirrors collector_passports
      // (defensive — if a prior acquisition didn't get its mirror,
      // this attempt repairs it idempotently).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('ensure_collector_passport', {
        p_user_id: user.id,
        p_passport_id: passportId,
      })
      return NextResponse.json({ already_owned: true })
    }
    console.error('[acquire] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to acquire passport' }, { status: 500 })
  }

  // Mirror to collector_passports — the canonical per-copy
  // record per CLAUDE.md governing invariant #8. The function
  // allocates the per-copy serial atomically + computes
  // expires_at from the passport's expiry_duration_days.
  // Idempotent: returns the existing row if already mirrored.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cpRows, error: cpErr } = await (supabase as any).rpc('ensure_collector_passport', {
    p_user_id: user.id,
    p_passport_id: passportId,
  })
  if (cpErr) {
    // Acquisitions row landed; the cp mirror failed. Surface
    // honestly but don't 500 — the purchase happened. A later
    // re-attempt (re-acquire, or a future repair job) will
    // populate the cp row.
    console.error('[acquire] collector_passports mirror failed:', cpErr)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cp = Array.isArray(cpRows) ? cpRows[0] : (cpRows as any)
  return NextResponse.json({
    success: true,
    acquisitionId: acquisition.id,
    copyNumber:    cp?.copy_number ?? null,
    expiresAt:     cp?.expires_at  ?? null,
  })
}
