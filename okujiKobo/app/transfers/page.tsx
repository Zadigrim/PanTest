// Passport transfers — server component.
//
// Shows:
//   • PENDING OFFERS for the viewer (their own to_user offers + offers
//     to institutions where they're can_manage_employees). Each row
//     gets Accept / Decline actions. Server-enforced authority means
//     showing them = they can act on them.
//   • For platform admins only: an "Initiate transfer" form + a list
//     of all transfers (pending and resolved) for visibility.
//
// Mutations go through the /api/transfers/* routes which call the
// SECURITY DEFINER functions from migration 051. Future work
// (creator-initiated transfers, richer notifications, ledger UI) can
// build on this surface; the v1 shape is intentionally minimal.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InitiateTransferForm } from '@/components/transfers/InitiateTransferForm'
import { TransferActions } from '@/components/transfers/TransferActions'

interface TransferRow {
  id:                 string
  passport_id:        string
  to_user_id:         string | null
  to_institution_id:  string | null
  initiated_by:       string
  initiated_at:       string
  status:             'pending' | 'accepted' | 'declined' | 'canceled'
  resolved_at:        string | null
  resolved_by:        string | null
  note:               string | null
}

interface PassportSummary {
  id:    string
  title: string
}

interface InstitutionSummary {
  id:   string
  name: string
}

interface ProfileSummary {
  id:           string
  display_name: string | null
}

export const metadata = {
  title: 'Transfers · okujiKobo',
}

export default async function TransfersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/transfers')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: profile } = await db
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()
  const isAdmin = profile?.is_platform_admin === true

  // RLS filters this for non-admins — see the four SELECT policies on
  // passport_transfers in migration 051. Admins get the lot; everyone
  // else gets their own + institution offers + transfers they
  // initiated.
  const { data: transfersRaw } = await db
    .from('passport_transfers')
    .select(
      'id, passport_id, to_user_id, to_institution_id, initiated_by, initiated_at, ' +
      'status, resolved_at, resolved_by, note',
    )
    .order('initiated_at', { ascending: false })
    .limit(200)

  const transfers: TransferRow[] = (transfersRaw ?? []) as TransferRow[]

  // Resolve passport titles + recipient names in one trip each for
  // display. Skipping these when there are none keeps the empty-state
  // page light.
  const passportIds = unique(transfers.map((t) => t.passport_id))
  const userIds = unique([
    ...transfers.map((t) => t.to_user_id).filter(Boolean) as string[],
    ...transfers.map((t) => t.initiated_by),
  ])
  const instIds = unique(transfers.map((t) => t.to_institution_id).filter(Boolean) as string[])

  const [passportRows, userRows, instRows] = await Promise.all([
    passportIds.length
      ? db.from('passports').select('id, title').in('id', passportIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? db.from('profiles').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    instIds.length
      ? db.from('institutions').select('id, name').in('id', instIds)
      : Promise.resolve({ data: [] }),
  ])
  const passports = new Map<string, PassportSummary>((passportRows.data ?? []).map((p: PassportSummary) => [p.id, p]))
  const users     = new Map<string, ProfileSummary>((userRows.data ?? []).map((p: ProfileSummary) => [p.id, p]))
  const insts     = new Map<string, InstitutionSummary>((instRows.data ?? []).map((i: InstitutionSummary) => [i.id, i]))

  const pendingForViewer = transfers.filter(
    (t) =>
      t.status === 'pending' &&
      // Server-side: RLS already only surfaced ones the viewer can read.
      // To distinguish "I can act" vs "I initiated", check that the
      // viewer is the recipient (to_user) or the initiator was someone
      // else (institutional case — RLS gave it to us because we can
      // manage employees).
      (t.to_user_id === user.id ||
        (t.to_institution_id !== null && t.initiated_by !== user.id)),
  )

  const otherTransfers = transfers.filter((t) => !pendingForViewer.includes(t))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-navy">Passport transfers</h1>
      <p className="mt-1 text-sm text-muted">
        Ownership changes for passports — offers you can accept, plus a record of past
        transfers you&apos;re a party to.
      </p>

      {/* ── Pending offers for me ─────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Pending offers ({pendingForViewer.length})
        </h2>
        {pendingForViewer.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No pending offers.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingForViewer.map((t) => {
              const passport = passports.get(t.passport_id)
              const recipientLabel = t.to_user_id
                ? `You (${users.get(t.to_user_id)?.display_name ?? 'you'})`
                : `${insts.get(t.to_institution_id ?? '')?.name ?? 'an institution'}`
              const initiator = users.get(t.initiated_by)?.display_name ?? 'an admin'
              return (
                <li
                  key={t.id}
                  className="rounded-panel border border-green/40 bg-cream px-4 py-3"
                >
                  <p className="text-sm font-semibold text-navy">
                    {passport?.title ?? 'A passport'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Offered to <strong className="text-navy">{recipientLabel}</strong> by {initiator}.
                  </p>
                  {t.note && (
                    <p className="mt-2 rounded-card bg-white/80 px-3 py-2 text-xs text-navy/90">
                      &ldquo;{t.note}&rdquo;
                    </p>
                  )}
                  <div className="mt-3">
                    <TransferActions transferId={t.id} mode="recipient" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Admin: initiate + history ─────────────────────────────────── */}
      {isAdmin && (
        <>
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Initiate a transfer (admin)
            </h2>
            <p className="mt-1 text-xs text-muted">
              Move a passport to an individual creator or an institution. The recipient
              gets a pending offer to accept or decline. Future work: creator-initiated
              transfers (the original creator offering, recipient accepting) — for now
              only platform admins can initiate.
            </p>
            <div className="mt-3 rounded-panel border border-hairline bg-white p-4">
              <InitiateTransferForm />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              All transfers ({transfers.length})
            </h2>
            {transfers.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No transfers yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {transfers.map((t) => {
                  const passport = passports.get(t.passport_id)
                  const recipient = t.to_user_id
                    ? users.get(t.to_user_id)?.display_name ?? 'user'
                    : insts.get(t.to_institution_id ?? '')?.name ?? 'institution'
                  const initiator = users.get(t.initiated_by)?.display_name ?? '—'
                  const statusColor =
                    t.status === 'accepted' ? 'text-green' :
                    t.status === 'declined' ? 'text-accent' :
                    t.status === 'canceled' ? 'text-muted' : 'text-navy'
                  const canCancel = t.status === 'pending'
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-white px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy">{passport?.title ?? '—'}</p>
                        <p className="truncate text-xs text-muted">
                          → {recipient} · initiated by {initiator}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ${statusColor} capitalize`}>{t.status}</span>
                      {canCancel && <TransferActions transferId={t.id} mode="admin-cancel" />}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Always render fresh — auth + pending-offer state shouldn't be cached.
export const dynamic = 'force-dynamic'
export const fetchCache = 'default-no-store'
