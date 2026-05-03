import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardClient } from './DashboardClient'
import type { Passport, Profile } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: passports }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('passports')
      .select('*')
      .eq('creator_id', user.id)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <DashboardClient
      profile={profile as Profile}
      passports={(passports ?? []) as Passport[]}
      userId={user.id}
    />
  )
}
