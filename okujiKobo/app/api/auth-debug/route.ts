import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  return NextResponse.json({
    authenticated: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: error?.message ?? null,
    hasSession: !!session,
    sessionExpiresAt: session?.expires_at ?? null,
  })
}
