import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PassportCard } from '@/components/marketplace/PassportCard'
import type { PassportWithDetails } from '@/lib/supabase/types'

export default async function CreatorPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: creator } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, website_url')
    .eq('id', params.id)
    .single()

  if (!creator) notFound()

  const { data: institution } = await supabase
    .from('institutions')
    .select('id, name, slug, logo_url')
    .eq('id', params.id)
    .maybeSingle()

  const { data: passports } = await supabase
    .from('passports')
    .select('*, quality_score:creator_quality_scores(composite_score, avg_mood_rating, completion_rate)')
    .eq('creator_id', params.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()
  const { data: acquisitions } = user
    ? await supabase.from('acquisitions').select('passport_id').eq('user_id', user.id)
    : { data: [] }
  const ownedIds = new Set((acquisitions ?? []).map((a: { passport_id: string }) => a.passport_id))

  // Aggregate quality across all passports
  const scores = (passports ?? []).map((p: PassportWithDetails) => p.quality_score)
  const avgMood = scores.length
    ? scores.reduce((s: number, q: PassportWithDetails['quality_score']) => s + (q?.avg_mood_rating ?? 0), 0) / scores.length
    : null
  const avgCompletion = scores.length
    ? scores.reduce((s: number, q: PassportWithDetails['quality_score']) => s + (q?.completion_rate ?? 0), 0) / scores.length
    : null

  const displayName = institution?.name ?? creator.display_name

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-5">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-cream text-3xl">
          {creator.avatar_url
            ? <img src={creator.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover" />
            : '🧭'}
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy">{displayName}</h1>
          {institution && (
            <p className="text-sm text-muted">Institutional creator</p>
          )}
          {creator.bio && (
            <p className="mt-2 max-w-2xl text-sm text-muted">{creator.bio}</p>
          )}
          {(avgMood !== null || avgCompletion !== null) && (
            <div className="mt-2 flex gap-4 text-sm text-muted">
              {avgMood !== null && <span>★ {avgMood.toFixed(1)} avg rating</span>}
              {avgCompletion !== null && <span>{Math.round(avgCompletion * 100)}% completion rate</span>}
              <span>{(passports ?? []).length} passports</span>
            </div>
          )}
        </div>
      </div>

      {/* Passport grid */}
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
        Passports
      </h2>
      {(passports ?? []).length === 0 ? (
        <p className="py-8 text-center text-muted">No published passports yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(passports as PassportWithDetails[]).map((passport) => (
            <PassportCard
              key={passport.id}
              passport={passport}
              isOwned={ownedIds.has(passport.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
