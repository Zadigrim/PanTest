import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceClient } from '@/components/design/WorkspaceClient'
import type { DesignerPassport, DesignerPassportPage, DesignerStop } from '@/lib/design/types'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  return { title: 'Designer — okuji' }
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

  // Load creator's institution_id to gate the stop-library share toggle
  const { data: profile } = await supabase
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .maybeSingle()
  const creatorInstitutionId: string | null =
    (profile as { institution_id: string | null } | null)?.institution_id ?? null

  // Load pages ordered by page_order. Closed pages (migration
  // 020 — closed_at IS NOT NULL) are filtered from the active
  // designer view. They live on in the DB for snapshot diffing
  // (republish-flow needs to see the closure event) but the
  // designer never edits a closed page; closure is final from
  // the editing surface.
  //
  // The .is('closed_at', null) chain casts through `any` because
  // `closed_at` isn't yet in the generated Database types — same
  // pattern as every other code surface that reads added-by-
  // migration columns (e.g. migration-040 stamps appearance
  // fields, migration-046 canonical pair).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pages } = await (supabase as any)
    .from('passport_pages')
    .select('*')
    .eq('passport_id', params.id)
    .is('closed_at', null)
    .order('page_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageIds = (pages ?? []).map((p: any) => p.id)

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
      creatorInstitutionId={creatorInstitutionId}
    />
  )
}
