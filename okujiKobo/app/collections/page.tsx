import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CollectionsList } from '@/components/collections/CollectionsList'
import type { PassportCollection } from '@/lib/collections/types'

export const metadata = { title: 'Collections — okuji Designer' }

export default async function CollectionsIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('passport_collections')
    .select('*')
    .eq('owner_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>Collections</h1>
        <p className="mt-1 text-[13px] text-muted">
          Group related passports and reward collectors for completing some or all of them.
        </p>
      </header>
      <CollectionsList initial={(data ?? []) as PassportCollection[]} />
    </main>
  )
}
