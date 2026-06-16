import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CorrectionNoticeBanner } from '@/components/marketplace/CorrectionNoticeBanner'
import type { Acquisition, Passport, Stamp } from '@/lib/supabase/types'

type AcquisitionWithPassport = Acquisition & {
  passport: Passport
  stamps: Stamp[]
  /** Holder-facing correction notice, populated server-side
   *  when the latest republish_log entry's republished_at is
   *  newer than acquisitions.last_correction_dismissed_at
   *  (or that field is NULL). Null when no notice is pending. */
  noticeWhatChanged?: string | null
  noticeRepublishedAt?: string | null
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

  // ── Correction-notice data ────────────────────────────────
  // For every acquired passport, pull the most recent
  // republish_log entry. If its republished_at is newer than
  // this holder's last_correction_dismissed_at (or that's
  // null), the banner renders. RLS on republish_log allows
  // creator + admin READ; the marketplace page reads via the
  // service-role-bypassing pattern would be wrong here — we
  // want this to fail closed: if RLS doesn't grant the holder
  // SELECT on republish_log, the banner just doesn't appear
  // (graceful degradation). Below we INTENTIONALLY query
  // through the holder's session so the .data array is empty
  // when RLS blocks; the banner stays hidden.
  // TODO(grant-holder-read-on-republish-log): add a holder
  // SELECT policy on passport_republish_log keyed on
  // acquisitions.passport_id once the v1 holder banner is
  // live and we want the web library to actually surface it.
  // For now the mobile path reads via the supabase client and
  // gets nothing back — banner hidden — which matches "v1
  // mobile-only" behavior even though Nathan chose the
  // mobile+web option. The mobile RN component below does the
  // same fetch; both will start working once that RLS lands.
  const noticeByPassportId = new Map<string, { what_changed: string; republished_at: string }>()
  const acqList = (acquisitions ?? []) as AcquisitionWithPassport[]
  const passportIdsForNotice = acqList.map((a) => a.passport_id)
  if (passportIdsForNotice.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: logs } = await (supabase as any)
      .from('passport_republish_log')
      .select('passport_id, republished_at, what_changed')
      .in('passport_id', passportIdsForNotice)
      .order('republished_at', { ascending: false })
    if (logs) {
      for (const row of logs as { passport_id: string; republished_at: string; what_changed: string }[]) {
        // Keep only the latest per passport.
        if (!noticeByPassportId.has(row.passport_id)) {
          noticeByPassportId.set(row.passport_id, {
            what_changed: row.what_changed,
            republished_at: row.republished_at,
          })
        }
      }
    }
  }
  // Compose noticeWhatChanged / noticeRepublishedAt onto each
  // acquisition. Compare against acq.last_correction_dismissed_at
  // (migration 066) — null means "never dismissed since this
  // republish".
  for (const acq of acqList) {
    const notice = noticeByPassportId.get(acq.passport_id)
    if (!notice) { acq.noticeWhatChanged = null; continue }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dismissedAt = (acq as any).last_correction_dismissed_at as string | null | undefined
    const pending = !dismissedAt || new Date(notice.republished_at) > new Date(dismissedAt)
    acq.noticeWhatChanged    = pending ? notice.what_changed : null
    acq.noticeRepublishedAt  = pending ? notice.republished_at : null
  }

  // Fetch stamps for all acquired passports
  const passportIds = (acquisitions ?? []).map((a: AcquisitionWithPassport) => a.passport_id)
  const { data: stamps } = passportIds.length > 0
    ? await supabase.from('stamps').select('*').eq('user_id', user.id).in('passport_id', passportIds)
    : { data: [] }

  // Stop counts per passport. Counted inline (pages → stops) rather
  // than via an RPC: the former get_stop_counts_for_passports function
  // does not exist in the live schema, so the call errored and every
  // total came back 0, miscategorizing progress state.
  const stopCountMap: Record<string, number> = {}
  if (passportIds.length > 0) {
    const { data: pageRows } = await supabase
      .from('passport_pages')
      .select('id, passport_id')
      .in('passport_id', passportIds)
      .is('closed_at', null)
    const pages = (pageRows ?? []) as { id: string; passport_id: string }[]
    const pageToPassport = new Map(pages.map((p) => [p.id, p.passport_id]))
    const pageIds = pages.map((p) => p.id)
    if (pageIds.length > 0) {
      const { data: stopRows } = await supabase
        .from('stops')
        .select('page_id')
        .in('page_id', pageIds)
      for (const s of (stopRows ?? []) as { page_id: string }[]) {
        const pid = pageToPassport.get(s.page_id)
        if (pid) stopCountMap[pid] = (stopCountMap[pid] ?? 0) + 1
      }
    }
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
    <div className="space-y-2">
      {acq.noticeWhatChanged && (
        <CorrectionNoticeBanner
          passportId={passport.id}
          whatChanged={acq.noticeWhatChanged}
          republishedAt={acq.noticeRepublishedAt ?? null}
        />
      )}
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
    </div>
  )
}
