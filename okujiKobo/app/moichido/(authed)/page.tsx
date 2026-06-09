import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RingMark } from '@/components/moichido/marks/RingMark'
import { SignOutButton } from '@/components/moichido/SignOutButton'
import { NewCardButton } from '@/components/moichido/designer/NewCardButton'

/**
 * Moichido merchant home — M4.2 pilot dashboard.
 *
 * Server-resolves the caller's moichido-merchant institution. If
 * they have none, they bounce to /moichido/auth/denied (honest
 * "not provisioned" message). If they have one, that institution
 * is the active merchant context. Multi-merchant context-switching
 * is M4.3+ scope; pilot picks the first by name.
 *
 * Honest data: every visible number runs a real COUNT query.
 * Empty merchant → all zeros, no fake metrics, no sample data
 * (CLAUDE.md governing invariant #6).
 *
 * The "Create card" button is disabled with "Coming in M4.3" — the
 * affordance exists so a pilot merchant sees the shape of the
 * surface, but it doesn't lie about being functional.
 */
export default async function MerchantHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/moichido/auth/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Resolve merchant institution: the caller's employee_authorizations
  // joined to institutions where institution_type='moichido_merchant'.
  const { data: authzRows } = await db
    .from('employee_authorizations')
    .select('institution_id, institutions!inner(id, name, institution_type)')
    .eq('user_id', user.id)
    .eq('institutions.institution_type', 'moichido_merchant')

  const merchantInstitutions = ((authzRows ?? []) as Array<{
    institutions: { id: string; name: string }
  }>)
    .map((r) => r.institutions)
    .filter(Boolean)

  if (merchantInstitutions.length === 0) {
    redirect('/moichido/auth/denied')
  }

  // Pilot: pick the first. Multi-merchant switcher = M4.3+.
  const institution = merchantInstitutions[0]

  // Honest counts. Each query traces to a real table. Zeros are
  // zeros — never substituted with sample data.
  // Punches-this-week uses a 7-day window from now.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // First pass: passport ids for this merchant. Used by holders +
  // punches scope. Empty list → use a sentinel that no real row
  // matches, so COUNT lands at 0 honestly.
  const { data: passportRows } = await db
    .from('passports')
    .select('id')
    .eq('proprietor_id', institution.id)
    .eq('credential_type', 'consumable')
  const passportIds = ((passportRows ?? []) as { id: string }[]).map((r) => r.id)
  const passportIdsForQuery = passportIds.length > 0
    ? passportIds
    : ['00000000-0000-0000-0000-000000000000']

  const [cardsRes, holdersRes, punchesRes] = await Promise.all([
    Promise.resolve({ count: passportIds.length }),
    db.from('collector_passports')
      .select('id', { count: 'exact', head: true })
      .in('passport_id', passportIdsForQuery),
    db.from('punches')
      .select('id, card_instance_id, card_instances!inner(collector_passport_id, collector_passports!inner(passport_id))', { count: 'exact', head: true })
      .in('card_instances.collector_passports.passport_id', passportIdsForQuery)
      .gte('punched_at', sevenDaysAgo),
  ])
  const cardCount    = cardsRes.count ?? 0
  const holderCount  = holdersRes.count ?? 0
  const punchCount7d = punchesRes.count ?? 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[3px] text-moichido-muted">
            Merchant
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-moichido-ink">
            {institution.name}
          </h1>
        </div>
        <SignOutButton />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active cards" value={cardCount} />
        <Stat label="Holders" value={holderCount} />
        <Stat label="Punches (last 7 days)" value={punchCount7d} />
      </section>

      <section className="rounded-[12px] border border-moichido-hairline bg-white p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-moichido-ink">Cards</h2>
            <p className="mt-2 text-sm text-moichido-muted">
              {cardCount === 0
                ? 'No punch cards yet. Start one to see it here.'
                : `You have ${cardCount} card${cardCount === 1 ? '' : 's'}.`}
            </p>
          </div>
          <NewCardButton />
        </div>
        {cardCount > 0 && (
          <div className="mt-4">
            <Link
              href="/moichido/cards"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-moichido-teal hover:underline"
            >
              <RingMark size={14} strokeWidth={2.4} />
              View all cards →
            </Link>
          </div>
        )}
      </section>

      <p className="text-[11px] text-moichido-muted">
        Pilot release. The terminal, punch designer, and analytics
        all land in later updates.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-moichido-hairline bg-white p-5">
      <p className="text-[11px] font-medium uppercase tracking-[2px] text-moichido-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-moichido-teal">{value}</p>
    </div>
  )
}
