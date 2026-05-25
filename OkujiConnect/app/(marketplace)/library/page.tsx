import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Acquisition, Passport, Stamp } from '@/lib/supabase/types'

type AcquisitionWithPassport = Acquisition & {
  passport: Passport
  stamps: Stamp[]
}

type LibraryState = 'in_progress' | 'completed' | 'not_started'

function getState(stamps: Stamp[], totalStops: number): LibraryState {
  if (stamps.length === 0) return 'not_started'
  if (stamps.length >= totalStops) return 'completed'
  return 'in_progress'
}

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/library')

  const { data: acquisitions } = await supabase
    .from('acquisitions')
    .select('*, passport:passports(*)')
    .eq('user_id', user.id)
    .order('acquired_at', { ascending: false })

  // Fetch stamps for all acquired passports
  const passportIds = (acquisitions ?? []).map((a: AcquisitionWithPassport) => a.passport_id)
  const { data: stamps } = passportIds.length > 0
    ? await supabase.from('stamps').select('*').eq('user_id', user.id).in('passport_id', passportIds)
    : { data: [] }

  // Fetch stop counts per passport
  const { data: stopCounts } = passportIds.length > 0
    ? await supabase.rpc('get_stop_counts_for_passports', { passport_ids: passportIds }).select()
    : { data: [] }

  const stopCountMap: Record<string, number> = {}
  for (const row of (stopCounts as { passport_id: string; stop_count: number }[] ?? [])) {
    stopCountMap[row.passport_id] = row.stop_count
  }

  const stampsByPassport: Record<string, Stamp[]> = {}
  for (const stamp of (stamps as Stamp[] ?? [])) {
    const pid = stamp.passport_id
    if (!stampsByPassport[pid]) stampsByPassport[pid] = []
    stampsByPassport[pid].push(stamp)
  }

  const inProgress: AcquisitionWithPassport[] = []
  const completed: AcquisitionWithPassport[] = []
  const notStarted: AcquisitionWithPassport[] = []

  for (const acq of (acquisitions as AcquisitionWithPassport[] ?? [])) {
    const myStamps = stampsByPassport[acq.passport_id] ?? []
    const total = stopCountMap[acq.passport_id] ?? 0
    const state = getState(myStamps, total)
    const enriched = { ...acq, stamps: myStamps }
    if (state === 'in_progress') inProgress.push(enriched)
    else if (state === 'completed') completed.push(enriched)
    else notStarted.push(enriched)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-serif text-2xl font-bold text-navy">My Library</h1>

      {inProgress.length > 0 && (
        <Section title="In Progress">
          {inProgress.map((acq) => (
            <LibraryRow
              key={acq.id}
              acq={acq}
              stampCount={acq.stamps.length}
              totalStops={stopCountMap[acq.passport_id] ?? 0}
            />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Completed">
          {completed.map((acq) => (
            <LibraryRow
              key={acq.id}
              acq={acq}
              stampCount={acq.stamps.length}
              totalStops={stopCountMap[acq.passport_id] ?? 0}
              completed
            />
          ))}
        </Section>
      )}

      {notStarted.length > 0 && (
        <Section title="Not Started">
          {notStarted.map((acq) => (
            <LibraryRow
              key={acq.id}
              acq={acq}
              stampCount={0}
              totalStops={stopCountMap[acq.passport_id] ?? 0}
            />
          ))}
        </Section>
      )}

      {(acquisitions ?? []).length === 0 && (
        <div className="rounded-panel border border-dashed border-hairline px-8 py-16 text-center">
          <p className="text-4xl">📖</p>
          <p className="mt-3 text-muted">No passports yet.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-green hover:underline">
            Browse passports →
          </Link>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function LibraryRow({
  acq,
  stampCount,
  totalStops,
  completed = false,
}: {
  acq: AcquisitionWithPassport
  stampCount: number
  totalStops: number
  completed?: boolean
}) {
  const passport = acq.passport
  const progress = totalStops > 0 ? stampCount / totalStops : 0

  return (
    <div className="flex items-center gap-4 rounded-panel border border-hairline bg-white p-4 shadow-sm">
      <div
        className="flex h-16 w-12 shrink-0 items-center justify-center rounded-card text-2xl"
        style={{ backgroundColor: passport.cover_bg_color ?? '#0D1B2A' }}
      >
        {passport.cover_emblem ?? '🧭'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-serif font-semibold text-navy">{passport.title}</p>
        {completed ? (
          <p className="text-xs text-green">
            ✓ Completed · {new Date(acq.acquired_at).toLocaleDateString()}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">
              {stampCount} of {totalStops} stops
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-green transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/passport/${passport.id}`}
          className="rounded-card bg-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-green transition-colors"
        >
          {completed ? 'View' : 'Continue →'}
        </Link>
      </div>
    </div>
  )
}
