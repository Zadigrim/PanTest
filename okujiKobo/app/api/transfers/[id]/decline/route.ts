// POST /api/transfers/[id]/decline — recipient declines a pending transfer.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.rpc('decline_passport_transfer', { p_transfer_id: id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
