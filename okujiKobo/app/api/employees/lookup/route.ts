import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/types'

function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  // BLD-02 enforcement: callers must scope to a target institution
  // and hold can_manage_employees there. Closes SEC-01's "any
  // employee row" temporary gate.
  //
  // - Admin: always allowed (no institutionId needed).
  // - Non-admin + institutionId provided: must hold
  //   can_manage_employees at that institution.
  // - Non-admin + no institutionId: forbidden. The only legit
  //   caller without an institution context is the admin-only
  //   comp-subscriptions page, and that already gates the page
  //   on is_platform_admin.
  const institutionId = typeof body?.institutionId === 'string' ? body.institutionId : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  if (!isAdminRpc) {
    if (!institutionId) {
      return NextResponse.json(
        { error: 'institutionId required for non-admin callers' },
        { status: 403 },
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authz } = await (supabase as any)
      .from('employee_authorizations')
      .select('can_manage_employees')
      .eq('user_id', user.id)
      .eq('institution_id', institutionId)
      .maybeSingle()
    if (!authz || authz.can_manage_employees !== true) {
      return NextResponse.json(
        { error: 'can_manage_employees required at this institution' },
        { status: 403 },
      )
    }
  }

  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.auth as any).admin.getUserByEmail(email)

  if (error || !data?.user) {
    return NextResponse.json(
      { error: `No Okuji account found for ${email}` },
      { status: 404 },
    )
  }

  return NextResponse.json({ userId: data.user.id })
}
