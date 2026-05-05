import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceClient } from '@/components/design/WorkspaceClient'
import type { DesignerPassport, DesignerPassportPage, DesignerStop } from '@/lib/design/types'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  return { title: 'Designer — PanoplyDesigner' }
}

/**
 * /design/[id] — The three-column passport designer workspace.
 *
 * This page is a server component that fetches passport data and passes it to
 * the client-side WorkspaceClient, which initialises the Zustand store.
 */
export default async function DesignWorkspacePage({ params }: Props) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load passport — must belong to current user
  const { data: passport } = await supabase
    .from('passports')
    .select('*')
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .single()

  if (!passport) notFound()

  // Load pages ordered by page_order
  const { data: pages } = await supabase
    .from('passport_pages')
    .select('*')
    .eq('passport_id', params.id)
    .order('page_order', { ascending: true })

  const pageIds = (pages ?? []).map((p) => p.id)

  // Load stops for all pages (skip query if no pages exist)
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
      passport={passport as unknown as DesignerPassport}
      pages={(pages ?? []) as unknown as DesignerPassportPage[]}
      stops={(stops ?? []) as unknown as DesignerStop[]}
    />
  )
}
