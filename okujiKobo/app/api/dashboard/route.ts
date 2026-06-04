import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadDashboard } from '@/lib/dashboard/load'

/**
 * Single batched JSON endpoint for the operator dashboard. The
 * server page renders via the same loader directly (zero
 * round-trips for SSR); this endpoint exists so future client-side
 * refresh paths reuse the exact same payload shape and query plan.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const data = await loadDashboard(supabase, user.id)
  return NextResponse.json(data, {
    headers: {
      // Per-request, never cached — KPIs and the audit reflect the
      // exact current owned-passport set.
      'Cache-Control': 'private, no-store',
    },
  })
}
