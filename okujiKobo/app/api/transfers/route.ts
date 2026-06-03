// POST /api/transfers — initiate a passport transfer.
// Body: { passport_id, to_user_id? | to_institution_id?, note? }
//
// Calls the SECURITY DEFINER initiate_passport_transfer() function
// which enforces platform-admin authority. The route is the transport;
// the SQL function is the gate.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  let body: {
    passport_id?:       string
    to_user_id?:        string | null
    to_institution_id?: string | null
    note?:              string
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }

  if (!body.passport_id) {
    return NextResponse.json({ error: 'passport_id required' }, { status: 400 })
  }
  if (!body.to_user_id && !body.to_institution_id) {
    return NextResponse.json({ error: 'to_user_id or to_institution_id required' }, { status: 400 })
  }
  if (body.to_user_id && body.to_institution_id) {
    return NextResponse.json({ error: 'exactly one of to_user_id / to_institution_id' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db.rpc('initiate_passport_transfer', {
    p_passport_id:       body.passport_id,
    p_to_user_id:        body.to_user_id ?? null,
    p_to_institution_id: body.to_institution_id ?? null,
    p_note:              body.note ?? null,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  return NextResponse.json({ ok: true, transfer_id: data })
}
