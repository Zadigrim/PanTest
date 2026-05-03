'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { spendTierLabel } from '@/lib/utils/spend-tiers'
import type { Passport, Profile } from '@/lib/supabase/types'

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-panoply-gray-2 text-panoply-gray-3',
  published: 'bg-panoply-teal-lt text-panoply-teal-dk',
  archived:  'bg-panoply-amber/15 text-panoply-amber',
}

function PassportCard({ passport }: { passport: Passport }) {
  const stopCount = 0 // placeholder — could be joined in query

  return (
    <Link
      href={`/passport/${passport.id}`}

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
          className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[passport.status ?? 'draft']}`}
        >
          {passport.status ?? 'draft'}
        </span>
      </div>

      <h3 className="mt-3 font-semibold text-panoply-navy group-hover:text-panoply-teal-dk transition-colors">
        {passport.title}
      </h3>

      {passport.description && (
        <p className="mt-1 text-sm text-panoply-gray-3 line-clamp-2">{passport.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-panoply-gray-3">
        <span>{spendTierLabel(passport.expected_spend_tier)}</span>
        {passport.transit_accessible && (
          <span title="Transit accessible">🚌</span>
        )}
        {passport.wheelchair_accessible && (
          <span title="Wheelchair accessible">♿</span>
        )}
      </div>

      <div className="mt-2 text-xs text-panoply-gray-3">
        Updated {new Date(passport.updated_at).toLocaleDateString()}
      </div>
    </Link>
  )
}

interface Props {
  profile: Profile | null
  passports: Passport[]
  userId: string
}

export function DashboardClient({ profile, passports, userId }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const createPassport = async () => {
    setCreating(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('passports')
      .insert({
        creator_id: userId,
        title: 'Untitled Passport',
        status: 'draft',
        cover_template: 'guilloche_blue',
        cover_paper_color: 'F5F2EC',
        cover_emblem: '🧭',
        cover_bg_color: '0D1B2A',
        is_published: false,
        price_cents: 0,
        transit_accessible: false,
        wheelchair_accessible: false,
      })
      .select()
      .single()

    setCreating(false)
    if (!error && data) {
      router.push(`/passport/${data.id}`)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      {/* Top nav */}
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧭</span>
            <span className="font-serif text-xl font-bold text-panoply-navy tracking-wide">
              PanoplyDesigner
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/certifications" className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors">
              🎓 Certifications
            </Link>
            <span className="text-sm text-panoply-gray-3">
              {profile?.display_name ?? 'Creator'}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-panoply-navy">My Passports</h1>
            <p className="mt-1 text-sm text-panoply-gray-3">
              {passports.length === 0
                ? 'Create your first passport to get started.'
                : `${passports.length} passport${passports.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Button onClick={createPassport} disabled={creating} size="lg">
            {creating ? 'Creating…' : '+ New passport'}
          </Button>
        </div>

        {/* Empty state */}
        {passports.length === 0 && (
          <div className="rounded-modal border-2 border-dashed border-panoply-gray-2 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-panoply-teal-lt text-3xl">
              🗺
            </div>
            <h2 className="text-lg font-semibold text-panoply-navy">No passports yet</h2>
            <p className="mt-2 text-sm text-panoply-gray-3">
              Create your first passport to start building experiences.
            </p>
            <Button className="mt-6" onClick={createPassport} disabled={creating}>
              {creating ? 'Creating…' : '+ Create first passport'}
            </Button>
          </div>
        )}

        {/* Passport grid */}
        {passports.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {passports.map((p) => (
              <PassportCard key={p.id} passport={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
