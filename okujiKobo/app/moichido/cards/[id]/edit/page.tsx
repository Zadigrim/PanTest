import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CardWorkspace } from '@/components/moichido/designer/CardWorkspace'
import type { DesignerPassport, DesignerPassportPage, DesignerStop } from '@/lib/design/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata() {
  return { title: 'Card designer · moichido' }
}

/**
 * /moichido/cards/[id]/edit — the moichido card designer surface.
 *
 * Server-side: authenticates the caller, confirms the card belongs
 * to a moichido_merchant institution the caller is attached to,
 * loads the same shape as okuji's /design/[id] (passport + pages +
 * stops), and renders CardWorkspace (the moichido-themed analogue
 * of WorkspaceClient).
 *
 * If the card isn't a consumable moichido card, 404 — this surface
 * doesn't render passport-world passports even if the URL is typed.
 */
export default async function CardEditPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passport } = await db
    .from('passports')
    .select('*')
    .eq('id', id)
    .eq('credential_type', 'consumable')
    .single()
  if (!passport) notFound()

  // Confirm the caller is a merchant at the passport's proprietor.
  // This is the auth gate — a stray okuji creator can't open a
  // moichido card here, even if they typed the URL.
  const { data: authz } = await db
    .from('employee_authorizations')
    .select('institution_id, institutions!inner(id, institution_type)')
    .eq('user_id', user.id)
    .eq('institution_id', passport.proprietor_id)
    .eq('institutions.institution_type', 'moichido_merchant')
    .maybeSingle()
  if (!authz) redirect('/moichido/auth/denied')

  // Pages — same shape as the okuji designer load.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pages } = await (supabase as any)
    .from('passport_pages')
    .select('*')
    .eq('passport_id', id)
    .is('closed_at', null)
    .order('page_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageIds = (pages ?? []).map((p: any) => p.id)

  const { data: stops } =
    pageIds.length > 0
      ? await supabase
          .from('stops')
          .select('*')
          .in('page_id', pageIds)
          .order('stop_order', { ascending: true })
      : { data: [] }

  return (
    <CardWorkspace
      passport={passport as unknown as DesignerPassport}
      pages={(pages ?? []) as unknown as DesignerPassportPage[]}
      stops={(stops ?? []) as unknown as DesignerStop[]}
    />
  )
}
