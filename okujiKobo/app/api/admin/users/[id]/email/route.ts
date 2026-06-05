import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/types'

/**
 * GET /api/admin/users/:id/email
 *
 * Returns the auth.users.email for a given profile id. Admin-only.
 *
 * Powering the email line in /access PersonDetailPanel — that
 * header needs the email to identify the row, but auth.users isn't
 * reachable via PostgREST and profiles doesn't carry it. The admin
 * SDK does, behind the service role key.
 *
 * RLS / authorization: hard-gated on is_platform_admin. The
 * service role key is never reachable from the client; the route
 * only proxies the lookup after verifying the caller's admin
 * status with the user-context Supabase client.
 *
 * Mirrors the pattern in /api/employees/lookup (which also uses
 * the service role key + admin SDK for an email→id translation;
 * this route does the inverse, id→email).
 */
function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.auth as any).admin.getUserById(id)
  if (error || !data?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ email: data.user.email ?? null })
}
