import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props) {
  const supabase = await createClient()
  const { data: stop } = await supabase
    .from('stops')
    .select('name')
    .eq('id', params.id)
    .eq('is_shared', true)
    .single()

  return { title: stop ? `${stop.name} — Stop Library` : 'Stop — OkujiConnect' }
}

// ---------------------------------------------------------------------------
// Classifier badge
// ---------------------------------------------------------------------------

function ClassifierBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-card bg-okuji-teal-lt px-2.5 py-0.5 text-xs font-medium text-okuji-teal-dk capitalize">
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Info row
// ---------------------------------------------------------------------------

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="text-xs font-semibold text-okuji-gray-3 uppercase tracking-wide sm:w-36 shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-okuji-navy">{children}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StopDetailPage({ params }: Props) {
  const supabase = await createClient()

  // Fetch the stop (must be shared)
  const { data: stop } = await supabase
    .from('stops')
    .select(
      `
      id,
      name,
      stamp_icon,
      address_city,
      address_state,
      address_street,
      classifiers,
      learning_objective,
      journal_prompt,
      grade_levels,
      subject_areas,
      created_at,
      creator_id,
      page_id,
      profiles:creator_id ( display_name ),
      passport_pages!page_id (
        passports (
          institutions:proprietor_id ( name )
        )
      )
    `,
    )
    .eq('id', params.id)
    .eq('is_shared', true)
    .single()

  if (!stop) notFound()

  // Count acknowledgments
  const { count: ackCount } = await supabase
    .from('presence_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('stop_id', params.id)

  // Count completions (presence_sessions with completion flag or separate query)
  const { count: completionCount } = await supabase
    .from('presence_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('stop_id', params.id)
    .eq('completed', true)

  const acknowledgments = ackCount ?? 0
  const completions = completionCount ?? 0
  const completionRate =
    acknowledgments > 0 ? Math.round((completions / acknowledgments) * 100) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stopData = stop as any
  const creatorName = stopData.profiles?.display_name ?? null
  const institutionName =
    stopData.passport_pages?.passports?.institutions?.name ?? null

  const location = [stopData.address_city, stopData.address_state]
    .filter(Boolean)
    .join(', ')

  const classifiers: string[] = Array.isArray(stopData.classifiers)
    ? stopData.classifiers
    : []
  const gradeLevels: string[] = Array.isArray(stopData.grade_levels)
    ? stopData.grade_levels
    : []
  const subjectAreas: string[] = Array.isArray(stopData.subject_areas)
    ? stopData.subject_areas
    : []

  return (
    <div className="min-h-screen bg-okuji-gray-1">
      {/* Header */}
      <header className="border-b border-okuji-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/stops"
            className="text-sm text-okuji-gray-3 hover:text-okuji-navy transition-colors"
          >
            ← Back to library
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        {/* Stop hero */}
        <div className="bg-white rounded-modal border border-okuji-gray-2 p-8 mb-6">
          {/* Icon + name */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel bg-okuji-gray-1 text-4xl"
              aria-hidden="true"
            >
              {stopData.stamp_icon ?? '📍'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-okuji-navy leading-tight">
                {stopData.name}
              </h1>
              {location && (
                <p className="text-sm text-okuji-gray-3 mt-0.5">{location}</p>
              )}
            </div>
          </div>

          {/* Classifiers */}
          {classifiers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {classifiers.map((c) => (
                <ClassifierBadge key={c} label={c} />
              ))}
            </div>
          )}

          {/* Metadata */}
          <dl className="space-y-3">
            {stopData.learning_objective && (
              <InfoRow label="Learning objective">
                {stopData.learning_objective}
              </InfoRow>
            )}

            {stopData.journal_prompt && (
              <InfoRow label="Journal prompt">{stopData.journal_prompt}</InfoRow>
            )}

            {gradeLevels.length > 0 && (
              <InfoRow label="Grade levels">
                <div className="flex flex-wrap gap-1.5">
                  {gradeLevels.map((g) => (
                    <span
                      key={g}
                      className="inline-flex items-center rounded-card bg-okuji-gray-2 px-2 py-0.5 text-xs font-medium text-okuji-navy"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}

            {subjectAreas.length > 0 && (
              <InfoRow label="Subject areas">
                <div className="flex flex-wrap gap-1.5">
                  {subjectAreas.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-card bg-okuji-gray-2 px-2 py-0.5 text-xs font-medium text-okuji-navy capitalize"
                    >
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}
          </dl>
        </div>

        {/* Stats + attribution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-panel border border-okuji-gray-2 p-5">
            <p className="text-xs font-semibold text-okuji-gray-3 uppercase tracking-wide mb-1">
              Acknowledgments
            </p>
            <p className="text-3xl font-bold tabular-nums text-okuji-navy">
              {acknowledgments}
            </p>
          </div>
          <div className="bg-white rounded-panel border border-okuji-gray-2 p-5">
            <p className="text-xs font-semibold text-okuji-gray-3 uppercase tracking-wide mb-1">
              Completion rate
            </p>
            <p className="text-3xl font-bold tabular-nums text-okuji-navy">
              {completionRate !== null ? `${completionRate}%` : '—'}
            </p>
            {acknowledgments > 0 && (
              <p className="text-xs text-okuji-gray-3 mt-1">
                {completions} of {acknowledgments} completed
              </p>
            )}
          </div>
        </div>

        {/* Attribution */}
        {(creatorName ?? institutionName) && (
          <div className="bg-white rounded-panel border border-okuji-gray-2 px-5 py-4 mb-8">
            <p className="text-sm text-okuji-gray-3">
              Created by{creatorName ? ` ${creatorName}` : ''}
              {institutionName ? ` at ${institutionName}` : ''}
            </p>
          </div>
        )}

        {/* Import CTA */}
        <div className="bg-okuji-teal/5 border border-okuji-teal-lt rounded-panel p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-okuji-navy text-sm">
              Import into my passport
            </p>
            <p className="text-xs text-okuji-gray-3 mt-0.5">
              A copy will be added to a draft passport of your choice.
            </p>
          </div>
          <Link
            href={`/stops?import=${params.id}`}
            className="shrink-0 inline-flex items-center h-9 px-5 rounded-panel bg-okuji-teal text-white text-sm font-medium hover:bg-[#0F6E56] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal"
          >
            Import this stop
          </Link>
        </div>
      </main>
    </div>
  )
}
