import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { detectRoles } from '@/lib/roles'
import { stopLocationIssue, type PublishStop } from '@/lib/design/publish-checklist'

export const metadata = { title: 'Stops needing location data — okuji' }

interface AuditRow {
  passportId: string
  passportTitle: string
  pageTitle: string | null
  stopName: string
  issue: 'coords' | 'address'
}

/**
 * Detail list behind the dashboard's coordinate audit. One row per
 * affected stop on a published passport the user owns, with the
 * passport · page · stop trail and a deep link into the designer.
 *
 * Logic match: uses the SAME stopLocationIssue helper as the publish
 * checklist, so banner / list / publish gate all agree about which
 * stops are blocked.
 */
export default async function DashboardAuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleContext = await detectRoles(supabase as any, user.id)
  const institutionIds = roleContext.institutions.map((i) => i.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Owned published passports.
  const ownedFilter = institutionIds.length > 0
    ? `creator_id.eq.${user.id},proprietor_id.in.(${institutionIds.join(',')})`
    : `creator_id.eq.${user.id}`

  const { data: ownedPub } = await db
    .from('passports')
    .select('id, title')
    .or(ownedFilter)
    .eq('is_published', true)

  const owned = (ownedPub ?? []) as { id: string; title: string }[]
  const passportTitle = new Map(owned.map((p) => [p.id, p.title]))
  const passportIds = owned.map((p) => p.id)

  let rows: AuditRow[] = []
  if (passportIds.length > 0) {
    const { data: pages } = await db
      .from('passport_pages')
      .select('id, passport_id, title')
      .in('passport_id', passportIds)
    const pageList = (pages ?? []) as { id: string; passport_id: string; title: string | null }[]
    const pageIds = pageList.map((p) => p.id)
    const pageInfo = new Map(pageList.map((p) => [p.id, p] as const))

    if (pageIds.length > 0) {
      const { data: stops } = await db
        .from('stops')
        .select('id, page_id, name, experience_type, experience_verification_method, verification_tier, lat, lng, address_street, address_city')
        .in('page_id', pageIds)

      for (const s of (stops ?? []) as (PublishStop & { id: string; page_id: string; name: string })[]) {
        const issue = stopLocationIssue(s)
        if (issue == null) continue
        const page = pageInfo.get(s.page_id)
        if (!page) continue
        rows.push({
          passportId: page.passport_id,
          passportTitle: passportTitle.get(page.passport_id) ?? 'Untitled',
          pageTitle: page.title,
          stopName: s.name || 'Untitled stop',
          issue,
        })
      }
    }
  }

  // Sort so all GPS-missing-coords float to top — they're higher
  // priority (most-common verification path).
  rows.sort((a, b) => {
    if (a.issue !== b.issue) return a.issue === 'coords' ? -1 : 1
    return a.passportTitle.localeCompare(b.passportTitle)
  })

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-[12px] text-muted hover:text-ink">← Dashboard</Link>
          <h1 className="mt-2 text-[24px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Stops needing location data
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            These published passports have stops that can&rsquo;t be verified by collectors until the missing
            location data is filled in. Click into any row to open the designer at that passport.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-surface-faintdiv bg-white px-6 py-12 text-center">
            <p className="text-[14px] font-semibold text-ink">No location issues.</p>
            <p className="mt-1 text-[12px] text-muted">
              Every published GPS stop has coordinates and every published QR stop has an address.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={`${r.passportId}-${i}`}>
                <Link
                  href={`/design/${r.passportId}`}
                  className="flex items-center gap-4 rounded-[8px] border border-surface-faintdiv bg-white px-4 py-3 transition-shadow hover:shadow-sm"
                >
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border-[1.5px] px-2 py-0.5 text-[10.5px] font-semibold uppercase ${
                      r.issue === 'coords'
                        ? 'border-red text-red'
                        : 'border-accent text-accent'
                    }`}
                  >
                    {r.issue === 'coords' ? 'GPS' : 'QR'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{r.stopName}</p>
                    <p className="truncate text-[11.5px] text-muted">
                      {r.passportTitle}
                      {r.pageTitle ? ` · ${r.pageTitle}` : ''}
                      {' · '}
                      {r.issue === 'coords' ? 'Missing latitude / longitude' : 'Missing street or city'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-muted">Fix in designer →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
