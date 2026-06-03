// POST /api/transfers/[id]/accept — recipient accepts a pending transfer.
//
// Authorization (server-enforced via accept_passport_transfer): only
// the to_user OR a can_manage_employees of the to_institution may
// accept. On success the passport's ownership is reassigned per the
// transfer-semantics spec in migration 051's header.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db.rpc('accept_passport_transfer', { p_transfer_id: id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  return NextResponse.json({ ok: true, result: data })
}
