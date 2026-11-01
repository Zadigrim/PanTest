import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CollectionEditor } from '@/components/collections/CollectionEditor'
import type { PassportCollection, CollectionReward, MemberPassport } from '@/lib/collections/types'

export const metadata = { title: 'Edit collection — okuji Designer' }

export default async function CollectionEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The collections tables are newer than the generated Supabase types snapshot,
  // so access them through a loosely-typed client (repo convention for
  // schema-lag). Shapes are enforced by the `as` casts below + migration 111.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: collection } = await sb
    .from('passport_collections').select('*').eq('id', id).single()
  if (!collection) redirect('/collections')

  const { data: items } = await sb
    .from('passport_collection_items')
    .select('passport_id, position, passport:passports(id, title, status)')
    .eq('collection_id', id)
    .order('position', { ascending: true })

  const { data: rewards } = await sb
    .from('passport_collection_rewards').select('*').eq('collection_id', id).order('created_at', { ascending: true })

  // The owner's own passports, for the searchable add-list (same query shape as
  // /design). Platform admins could add any published passport, but the simple
  // editor scopes to the owner's own; official mixed-creator collections are a
  // manual/admin path.
  const { data: myPassports } = await supabase
    .from('passports')
    .select('id, title, status')
    .eq('creator_id', user.id)
    .eq('credential_type', 'persistent')
    .order('updated_at', { ascending: false })

  const memberRows = (items ?? []).map((it: any) => ({
    passport_id: it.passport_id as string,
    position: it.position as number,
    // supabase types the embed as an array or object depending on the relation;
    // normalize to a single passport.
    passport: (Array.isArray(it.passport) ? it.passport[0] : it.passport) as MemberPassport,
  }))

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <CollectionEditor
        collection={collection as PassportCollection}
        members={memberRows}
        rewards={(rewards ?? []) as CollectionReward[]}
        myPassports={(myPassports ?? []) as MemberPassport[]}
      />
    </main>
  )
}
