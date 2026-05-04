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

  // Insert acquisition
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
      return NextResponse.json({ already_owned: true })
    }
    console.error('[acquire] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to acquire passport' }, { status: 500 })
  }

  return NextResponse.json({ success: true, acquisitionId: acquisition.id })
}
