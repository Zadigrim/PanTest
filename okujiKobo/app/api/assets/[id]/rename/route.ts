import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/assets/[id]/rename
 *
 * Sets the asset's `display_name` (the friendly title shown on
 * cards + in the drawer). Writes `null` to clear it (UI then falls
 * back to a prettified filename).
 *
 * Authorization: RLS — only the asset's owner can update the row.
 * The route does not re-check ownership in app code; supabase
 * returns 0 rows updated for non-owners which we treat as 403.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: { display_name?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  // Normalise: empty string → null (so the UI fallback kicks in).
  const next =
    typeof body.display_name === 'string' && body.display_name.trim()
      ? body.display_name.trim().slice(0, 120)
      : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('design_assets')
    .update({ display_name: next })
    .eq('id', params.id)
    .select('id, display_name')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    // Either the asset doesn't exist, or RLS hid the update from us
    // (non-owner). Same response — don't leak existence.
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json({ id: data.id, display_name: data.display_name })
}
