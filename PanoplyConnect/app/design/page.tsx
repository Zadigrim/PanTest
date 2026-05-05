import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewPassportButton } from '@/components/design/NewPassportButton'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import type { DesignerPassport } from '@/lib/design/types'

export const metadata = { title: 'My Passports — PanoplyDesigner' }

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-panoply-gray-2 text-panoply-gray-3',
  published: 'bg-panoply-teal-lt text-panoply-teal-dk',
  archived:  'bg-panoply-amber/15 text-panoply-amber',
}

function PassportCard({ passport }: { passport: DesignerPassport }) {
  return (
    <Link
      href={`/design/${passport.id}`}
      className="group block rounded-panel border border-panoply-gray-2 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card text-2xl"
          style={{ backgroundColor: `#${passport.cover_paper_color ?? 'F5F2EC'}` }}
        >
          {passport.cover_emblem ?? '🧭'}
        </div>
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLES[passport.status ?? 'draft']
          }`}
        >
          {passport.status ?? 'draft'}
        </span>
      </div>

      <h3 className="mt-3 font-semibold text-panoply-navy group-hover:text-panoply-teal-dk transition-colors">
        {passport.title}
      </h3>

      {passport.description && (
        <p className="mt-1 text-sm text-panoply-gray-3 line-clamp-2">
          {passport.description}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-panoply-gray-3">
        <span>{spendTierLabel(passport.expected_spend_tier)}</span>
        {passport.transit_accessible && <span title="Transit accessible">🚌</span>}
        {passport.wheelchair_accessible && <span title="Wheelchair accessible">♿</span>}
      </div>

      <div className="mt-2 text-xs text-panoply-gray-3">
        Updated {new Date(passport.updated_at).toLocaleDateString()}
      </div>
    </Link>
  )
}

export default async function DesignIndexPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: passports } = await supabase
    .from('passports')
    .select('*')
    .eq('creator_id', user.id)
    .order('updated_at', { ascending: false })

  const list = (passports ?? []) as DesignerPassport[]

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      {/* Top bar */}
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧭</span>
            <span className="font-serif text-xl font-bold text-panoply-navy tracking-wide">
              PanoplyDesigner
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors"
          >
            ← Back to Panoply
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-panoply-navy">My Passports</h1>
            <p className="mt-1 text-sm text-panoply-gray-3">
              {list.length === 0
                ? 'Create your first passport to get started.'
                : `${list.length} passport${list.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {/* NewPassportButton is a client component — it calls the API route */}
          <NewPassportButton userId={user.id} />
        </div>

        {/* Empty state */}
        {list.length === 0 && (
          <div className="rounded-modal border-2 border-dashed border-panoply-gray-2 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-panoply-teal-lt text-3xl">
              🗺
            </div>
            <h2 className="text-lg font-semibold text-panoply-navy">No passports yet</h2>
            <p className="mt-2 text-sm text-panoply-gray-3">
              Create your first passport to start building experiences.
            </p>
            <div className="mt-6">
              <NewPassportButton userId={user.id} />
            </div>
          </div>
        )}

        {/* Passport grid */}
        {list.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <PassportCard key={p.id} passport={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
