import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MoichidoLoginForm } from '@/components/moichido/auth/MoichidoLoginForm'

/**
 * Moichido merchant login surface.
 *
 * Server-side: if the caller is already signed in, bounce them
 * back to /moichido/ (the middleware's host gate ensures that
 * resolves to the merchant home). The form itself is the
 * client component below.
 */
export default async function MoichidoLoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/moichido')

  return (
    <Suspense>
      <MoichidoLoginForm />
    </Suspense>
  )
}
