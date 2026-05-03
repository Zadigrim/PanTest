import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WorkspaceClient } from '@/components/designer/WorkspaceClient'
import type { Passport, PassportPage, Stop } from '@/lib/supabase/types'

interface Props {
  params: { id: string }
}

export default async function PassportWorkspacePage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: passport } = await supabase
    .from('passports')
    .select('*')
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .single()

  if (!passport) notFound()

  const { data: pages } = await supabase
    .from('passport_pages')
    .select('*')
    .eq('passport_id', params.id)
    .order('page_order', { ascending: true })

  const pageIds = (pages ?? []).map((p) => p.id)

  const { data: stops } =
    pageIds.length > 0
      ? await supabase
          .from('stops')
          .select('*')
          .in('page_id', pageIds)
          .order('stop_order', { ascending: true })
      : { data: [] }

  return (
    <WorkspaceClient
      passport={passport as Passport}
      pages={(pages ?? []) as PassportPage[]}
      stops={(stops ?? []) as Stop[]}
    />
  )
}
