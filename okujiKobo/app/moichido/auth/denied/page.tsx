import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wordmark } from '@/components/moichido/Wordmark'
import { RingMark } from '@/components/moichido/marks/RingMark'
import { SignOutButton } from '@/components/moichido/SignOutButton'

/**
 * Reached when an authenticated user lands on the moichido surface
 * but has no employee_authorizations row at any
 * institution_type='moichido_merchant' institution. Pilot path:
 * merchants are admin-provisioned, so the honest message is
 * "we don't see a merchant account for you yet."
 *
 * Their okuji.app session (if any) is untouched — cookies are
 * host-scoped. Sign-out from here only clears the moichido cookie.
 */
export default async function MoichidoDeniedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login')

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="text-moichido-apricot">
          <RingMark size={56} strokeWidth={2.4} />
        </span>
        <Wordmark className="mt-4 text-3xl text-moichido-paper" />
      </div>
      <div className="rounded-[12px] bg-moichido-paper p-8 shadow-lg text-center">
        <h1 className="text-base font-semibold text-moichido-ink">
          No merchant account
        </h1>
        <p className="mt-3 text-sm text-moichido-muted">
          You&apos;re signed in as <span className="font-mono text-moichido-ink">{user.email}</span>,
          but no moichido merchant account is associated with this email
          yet.
        </p>
        <p className="mt-2 text-sm text-moichido-muted">
          Pilot merchants are provisioned manually. Reach out to your
          moichido representative to get an account set up.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
