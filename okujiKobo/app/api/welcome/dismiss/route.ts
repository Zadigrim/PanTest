import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/welcome/dismiss
 *
 * Marks the current user's first-login welcome modal as seen
 * by stamping profiles.welcome_seen_at = now(). Idempotent:
 * if the column is already set, an additional write is
 * harmless — we deliberately do not enforce
 * `WHERE welcome_seen_at IS NULL` so the route stays simple.
 *
 * No body. No response shape beyond { ok: true } — the caller
 * already optimistically hides the modal; the server call
 * exists only to persist the state.
 *
 * RLS: profiles has a self-update policy keyed on
 * id = auth.uid(); no extra policy added in migration 059.
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ welcome_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json({ error: (error as any).message ?? 'Failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
