import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Platform-admin gate for the merchant console. Server-side is_platform_admin
 * check (the canonical gate) — the moichido (authed) parent layout already
 * supplies merchant chrome + requires sign-in; this adds the admin gate.
 * Renders on the moichido surface only (it lives under app/moichido/*, which
 * the okuji host 404s).
 */
export default async function MerchantsAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login?next=/moichido/merchants')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) {
    return (
      <div className="rounded-[12px] border border-moichido-hairline bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-moichido-ink">Not authorized</h1>
        <p className="mt-2 text-sm text-moichido-muted">This console is for platform admins only.</p>
      </div>
    )
  }
  return <>{children}</>
}
