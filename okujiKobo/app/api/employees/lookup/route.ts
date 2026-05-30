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

  // Phase 0 gate: caller must be a platform admin OR hold any employee
  // authorization. This closes the public email-enumeration oracle while
  // keeping the /manage/employees and /access/institutions/[id] add-staff
  // flows working for non-admin institutional managers. Phase 2 (BLD-02)
  // tightens this further to require can_manage_employees at the target
  // institution.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  if (!isAdminRpc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: empCount } = await (supabase as any)
      .from('employee_authorizations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!empCount || empCount === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
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
