import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { detectRoles } from '@/lib/roles'

export const metadata = { title: 'Program — okuji' }

interface PassportRow {
  id: string
  title: string
  status: string
  is_published: boolean
  prizeTexts: string[]
  acquisitionCount: number
  prizeDistributedCount: number
}

/**
 * /program — v1 program overview.
 *
 * Honest minimum: lists the user's (and their institution's)
 * passports with the prize text that's actually been written on
 * any page, plus a per-passport count of collectors who acquired
 * the passport. No fabricated numbers.
 *
 * What it deliberately does NOT show in v1:
 *   - "Prizes redeemed" — there's no redemption tracking table yet.
 *     `prize_distributed` on completion_tokens is a boolean flag a
 *     staff member sets when they HAND OUT a prize; it isn't the
 *     collector redemption event. We DO surface the distributed
 *     count as "Prizes handed out" so the operator can audit who's
 *     been served, but we don't call it redemption.
 *   - Per-page distribution detail / the employee terminal — those
 *     are the dormant pieces this page extends when built (see
 *     docs/DASHBOARD_REVIEW.md).
 *
 * Routing: linked from the dashboard's Jump-to tiles. The Program
 * tile is gated by role (individual_creator / institutional_manager
 * / platform_admin) — institutional employees and designers without
 * those roles see the tile disabled.
 */
export default async function ProgramPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleContext = await detectRoles(supabase as any, user.id)
  const institutionIds = roleContext.institutions.map((i) => i.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const ownedFilter = institutionIds.length > 0
    ? `creator_id.eq.${user.id},proprietor_id.in.(${institutionIds.join(',')})`
    : `creator_id.eq.${user.id}`

  const { data: ownedRaw } = await db
    .from('passports')
    .select('id, title, status, is_published')
    .or(ownedFilter)
    .order('updated_at', { ascending: false })

  const owned = (ownedRaw ?? []) as { id: string; title: string; status: string; is_published: boolean }[]
  const ownedIds = owned.map((p) => p.id)

  let rows: PassportRow[] = []

  if (ownedIds.length > 0) {
    const [pagesRes, acqRes, tokensRes] = await Promise.all([
      db.from('passport_pages')
        .select('passport_id, prize_description')
        .in('passport_id', ownedIds),
      db.from('acquisitions')
        .select('passport_id')
        .in('passport_id', ownedIds),
      // Prizes handed out (distributed=true on completion_tokens).
      // Per-passport count of prizes a staff member has marked
      // delivered. NOT the same as "redeemed by collector" —
      // redemption tracking doesn't exist yet.
      db.from('completion_tokens')
        .select('passport_id, prize_distributed')
        .in('passport_id', ownedIds)
        .eq('prize_distributed', true),
    ])

    const prizesByPassport = new Map<string, string[]>()
    for (const p of (pagesRes.data ?? []) as { passport_id: string; prize_description: string | null }[]) {
      const text = p.prize_description?.trim()
      if (!text) continue
      const arr = prizesByPassport.get(p.passport_id) ?? []
      arr.push(text)
      prizesByPassport.set(p.passport_id, arr)
    }

    const acqByPassport = new Map<string, number>()
    for (const a of (acqRes.data ?? []) as { passport_id: string }[]) {
      acqByPassport.set(a.passport_id, (acqByPassport.get(a.passport_id) ?? 0) + 1)
    }

    const distByPassport = new Map<string, number>()
    for (const t of (tokensRes.data ?? []) as { passport_id: string }[]) {
      distByPassport.set(t.passport_id, (distByPassport.get(t.passport_id) ?? 0) + 1)
    }

    rows = owned.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      is_published: p.is_published,
      prizeTexts: prizesByPassport.get(p.id) ?? [],
      acquisitionCount: acqByPassport.get(p.id) ?? 0,
      prizeDistributedCount: distByPassport.get(p.id) ?? 0,
    }))
  }

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6">
          <Link href="/" className="text-[12px] text-muted hover:text-ink">← Dashboard</Link>
          <h1 className="mt-2 text-[26px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Program
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Prizes, collectors, and what each passport offers. One row per passport.
            Prize text is whatever you&rsquo;ve written on the page&rsquo;s Prize section in the designer.
          </p>
        </header>

        {/* Dormant-pieces note — honest signal about what's NOT here. */}
        <div className="mb-6 rounded-[8px] border border-surface-faintdiv bg-white px-4 py-3 text-[12px] text-muted">
          <span className="font-semibold text-ink">Coming later: </span>
          per-collector distribution tracking, a redemption record, and the
          employee terminal for handing prizes out in person. The counts on
          this page reflect today&rsquo;s data — collectors who&rsquo;ve acquired the
          passport, and prizes a staff member has marked delivered.
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <PassportProgramRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PassportProgramRow({ row }: { row: PassportRow }) {
  const statusPill =
    row.status === 'published' ? 'border-green text-green'
    : row.status === 'archived' ? 'border-accent text-accent'
    : 'border-muted text-muted'

  return (
    <article className="rounded-[10px] border border-surface-faintdiv bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-ink">{row.title}</h2>
            <span
              className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase ${statusPill}`}
            >
              {row.status}
            </span>
          </div>
        </div>
        <Link
          href={`/design/${row.id}`}
          className="shrink-0 rounded-[6px] border-[1.5px] border-ink bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-surface-workspace"
        >
          Open in designer →
        </Link>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-4">
        <Stat label="Collectors" value={row.acquisitionCount} />
        <Stat label="Prizes handed out" value={row.prizeDistributedCount} />
        <Stat label="Prize entries" value={row.prizeTexts.length} hint="across all pages" />
        <Stat label="Status" value={row.is_published ? 'Live' : '—'} />
      </dl>

      {row.prizeTexts.length > 0 ? (
        <section className="mt-3 border-t border-surface-faintdiv pt-3">
          <p className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
            Prize text on pages
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {row.prizeTexts.map((t, i) => (
              <li key={i} className="text-[12.5px] text-ink">{t}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-3 border-t border-surface-faintdiv pt-3 text-[12px] text-muted">
          No prize text set on any page yet. Add it in the designer&rsquo;s page inspector → Prize.
        </p>
      )}
    </article>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
        {value}
        {hint && <span className="ml-1 text-[10px] font-normal text-muted">{hint}</span>}
      </dd>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-[10px] border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <p className="text-[14px] font-semibold text-ink">No passports yet</p>
      <p className="mt-1 text-[12px] text-muted">
        Once you publish a passport with a prize, it&rsquo;ll show up here.
      </p>
      <Link
        href="/design"
        className="mt-4 inline-flex items-center rounded-[8px] border-[1.5px] border-ink bg-green px-4 h-9 text-[13px] font-semibold text-white"
      >
        Create a passport
      </Link>
    </div>
  )
}
