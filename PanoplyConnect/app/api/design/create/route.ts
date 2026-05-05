import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/design/create
 *
 * Creates a blank passport for the authenticated user and returns { id }.
 * The client then redirects to /design/[id].
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
