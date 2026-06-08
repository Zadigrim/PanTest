import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { M3TestClient } from './M3TestClient'

/**
 * /m3-test — minimal end-to-end test surface for the M3 consumable
 * credential loop. Platform-admin only; not linked from any chrome.
 *
 * The page wires three forms to the new function surface:
 *   - issue a one-off stop_qr_token (vendor-side)
 *   - consume a token + record a punch (collector-side, with optional GPS)
 *   - redeem a completion_token (employee-side, persistent or consumable)
 *
 * Full merchant token-issue UI + the mobile QR-scan path land in M4.
 * This page is the smallest thing that lets the whole loop be
 * exercised end-to-end without binary changes.
 */
export default async function M3TestPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Platform-admin gate. is_platform_admin is the single admin check
  // per CLAUDE.md governing invariant #4.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (!isAdmin) redirect('/')

  return <M3TestClient />
}
