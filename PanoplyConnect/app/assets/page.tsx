import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * /assets — redirects to the default tab: backgrounds.
 * Auth check happens here; the tab pages inherit the user session.
 */
export default async function AssetsIndexPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/assets')

  redirect('/assets/backgrounds')
}
