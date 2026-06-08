import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InspectLanding } from './InspectLanding'

export const metadata = { title: 'Inspect passport — okuji' }

/**
 * /access/inspect — admin-only landing for the read-only passport
 * inspection capability.
 *
 * Gate: platform admins only. Non-admins are redirected to /access
 * (their normal management surface). The /access/inspect/[id] route
 * re-asserts the same gate; this page is the discoverable entry
 * point and the ID-paste affordance.
 *
 * Per the M-Admin-Inspect Phase 0 decision, the lookup is paste-ID
 * only — no fuzzy search, no title substring. Admins arrive here
 * with a specific passport in mind (a report, a referral, a content-
 * safety review), not to browse.
 */
export default async function InspectLandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/access/inspect')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (!isAdmin) redirect('/access')

  return <InspectLanding />
}
