// Account closure endpoint — POST /api/account/close
//
// Calls the public.close_user_account(uuid) Postgres function. The
// function itself enforces auth (caller must equal target OR be a
// platform admin); this route is the thin transport layer.
//
// The function runs in a single transaction. On success it returns
// a JSON summary (counts of deleted/reassigned passports). On error
// it raises and the route surfaces a 500 with the message.
//
// IMPORTANT — destructive, irreversible. The /profile "Danger Zone"
// section still shows a disabled button pointing at support; this
// endpoint is wired up so admin tooling (Nathan or a future
// self-serve UI) can trigger closure without going through Studio.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Body is optional. If omitted, close the caller's own account.
  // If `target_user_id` is supplied, the Postgres function checks
  // platform-admin authority and rejects otherwise.
  let target: string = user.id
  try {
    const body = (await req.json()) as { target_user_id?: string } | undefined
    if (body?.target_user_id) target = body.target_user_id
  } catch {
    // No body / not JSON — default to closing the caller's own account.
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db.rpc('close_user_account', { target_user_id: target })
  if (error) {
    console.error('[close_user_account] rpc failed', { target, error })
    return NextResponse.json({ error: error.message ?? 'closure failed' }, { status: 500 })
  }

  // The user's session is now orphaned (their auth.users row is gone).
  // We sign them out so the cookie clears cleanly on the next request.
  if (target === user.id) {
    await supabase.auth.signOut()
  }

  return NextResponse.json({ ok: true, summary: data })
}
