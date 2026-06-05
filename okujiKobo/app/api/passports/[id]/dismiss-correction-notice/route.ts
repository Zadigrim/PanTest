import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/passports/:id/dismiss-correction-notice
 *
 * Marks the most recent correction notice as dismissed for
 * the current holder by stamping `last_correction_dismissed_at`
 * on BOTH `acquisitions` and `collector_passports` rows
 * (whichever the holder has). Web reads from acquisitions;
 * mobile reads from collector_passports — same dismiss
 * clears both surfaces.
 *
 * Idempotent: dismissing again just overwrites the
 * timestamp. Future republishes (newer republished_at) will
 * surface the banner again automatically — the comparison
 * happens at render time.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: passportId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Both updates run regardless of whether a row exists in
  // the table — RLS scopes the update by user_id +
  // passport_id so a non-holder gets zero-row updates without
  // throwing.
  await Promise.all([
    db.from('acquisitions')
      .update({ last_correction_dismissed_at: now })
      .eq('user_id', user.id)
      .eq('passport_id', passportId),
    db.from('collector_passports')
      .update({ last_correction_dismissed_at: now })
      .eq('user_id', user.id)
      .eq('passport_id', passportId),
  ])

  return NextResponse.json({ ok: true })
}
