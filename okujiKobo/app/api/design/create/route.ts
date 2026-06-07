import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrialUsage } from '@/lib/trial/limits'

/**
 * POST /api/design/create
 *
 * Creates a blank passport for the authenticated user and returns { id }.
 * The client then redirects to /design/[id].
 *
 * Trial cap (DEC-03 / BLD-06): Free-tier users are capped at 3
 * personal passports. Pro / Studio / platform-admin callers
 * bypass the cap. Institution-owned passports don't go through
 * this route (no "create as institution" path here today), so the
 * cap is checked unconditionally for the personal-passport flow
 * this route serves.
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Trial-cap gate. getTrialUsage returns canCreatePassport=true
  // for admins / Pro / Studio holders, so the explicit branches
  // for those bypasses live inside the helper.
  const usage = await getTrialUsage(supabase, user.id)
  if (!usage.canCreatePassport) {
    return NextResponse.json(
      {
        error: 'Free-tier trial limit reached',
        detail: `You have ${usage.passportsUsed} of ${usage.passportsCap} trial passports. Upgrade to Pro or Studio for unlimited passports.`,
        passportsUsed: usage.passportsUsed,
        passportsCap: usage.passportsCap,
      },
      { status: 402 }, // Payment Required — semantically precise for an upgrade gate
    )
  }

  const { data, error } = await supabase
    .from('passports')
    .insert({
      creator_id: user.id,
      title: 'Untitled Passport',
      status: 'draft',
      cover_template: 'guilloche_blue',
      cover_paper_color: 'F5F2EC',
      cover_emblem: '🧭',
      cover_bg_color: '0D1B2A',
      is_published: false,
      price_cents: 0,
      transit_accessible: false,
      wheelchair_accessible: false,
      passport_type: 'location',
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create passport' },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: data.id })
}
