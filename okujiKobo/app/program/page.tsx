import { redirect } from 'next/navigation'
import Link from 'next/link'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/lib/supabase/server'
import { detectRoles } from '@/lib/roles'
import { loadProgramOverview } from '@/lib/program/load'
import { ProgramTabs, PROGRAM_TAB_KEYS, type ProgramTabKey } from './ProgramTabs'
import { OverviewTab } from './_tabs/OverviewTab'
import { PassportsTab, type PassportProgramRowData } from './_tabs/PassportsTab'
import { AnalyticsTab } from './_tabs/AnalyticsTab'
import { TerminalTab } from './_tabs/TerminalTab'
import { EmployeesPanel } from '@/components/program/EmployeesPanel'
import { PrizesPanel } from '@/components/program/PrizesPanel'

export const metadata = { title: 'Program — okuji' }

/**
 * /program — institutional program hub.
 *
 * Tab state in URL (?tab=…) so SSR can render the active tab
 * directly and deep links / back-button restore correctly. Old
 * /manage/* URLs redirect into the matching tab — no broken
 * bookmarks. The full-screen /terminal stays at its own URL because
 * its gesture mechanics need the canvas; the Terminal tab is a
 * launcher panel.
 *
 * Role gating: any of individual_creator / institutional_manager /
 * platform_admin can land here. Lower roles see the JumpTiles
 * "Program" tile disabled — they'd never reach this page.
 *
 * Honest data throughout. Six KPI cards on Overview, all from real
 * queries in lib/program/load.ts. No illustrative numbers, ever.
 * The two cards that don't have a source yet (collector-side
 * redemption) are NOT rendered — see lib/dashboard/flags.ts pattern
 * for how those would activate when KI-02 lands.
 */
export default async function ProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; passport?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/program')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleContext = await detectRoles(supabase as any, user.id)
  const institutionIds = roleContext.institutions.map((i) => i.id)

  // Resolve active tab — default 'overview', clamp unknown values.
  const sp = await searchParams
  const requested = (sp.tab ?? 'overview') as ProgramTabKey
  const tab: ProgramTabKey = (PROGRAM_TAB_KEYS as readonly string[]).includes(requested)
    ? requested
    : 'overview'
  const selectedPassportId = sp.passport ?? null

  // The Passports tab still needs its v1 row data + the Overview /
  // Analytics tabs share one batched load. Fetch in parallel.
  const overviewP = loadProgramOverview(supabase, user.id, institutionIds)
  const passportsP = loadPassportsTabRows(supabase, user.id, institutionIds)

  const [overview, passportsRows] = await Promise.all([overviewP, passportsP])

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-4">
          <Link href="/" className="text-[12px] text-muted hover:text-ink">← Dashboard</Link>
          <h1 className="mt-2 text-[26px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Program
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Your institution&rsquo;s operating surface — passports, employees, prizes,
            analytics, terminal. Numbers come straight from real activity.
          </p>
        </header>

        <ProgramTabs active={tab} />

        <div className="pt-6">
          {tab === 'overview'  && <OverviewTab data={overview} />}
          {tab === 'passports' && <PassportsTab rows={passportsRows} />}
          {tab === 'employees' && <EmployeesPanel />}
          {tab === 'prizes'    && <PrizesPanel />}
          {tab === 'analytics' && <AnalyticsTab data={overview} selectedPassportId={selectedPassportId} />}
          {tab === 'terminal'  && <TerminalTab pendingDistribution={overview.kpis.pendingDistribution} />}
        </div>
      </main>
    </div>
  )
}

// ── Passports tab data loader ───────────────────────────────────────────────
// Keeps the v1 /program shape exactly so this tab matches what
// existed at /program before the consolidation.

async function loadPassportsTabRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  institutionIds: string[],
): Promise<PassportProgramRowData[]> {
  const ownedFilter = institutionIds.length > 0
    ? `creator_id.eq.${userId},proprietor_id.in.(${institutionIds.join(',')})`
    : `creator_id.eq.${userId}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: ownedRaw } = await db
    .from('passports')
    .select('id, title, status, is_published')
    .or(ownedFilter)
    .order('updated_at', { ascending: false })

  const owned = (ownedRaw ?? []) as { id: string; title: string; status: string; is_published: boolean }[]
  const ownedIds = owned.map((p) => p.id)
  if (ownedIds.length === 0) return []

  const [pagesRes, acqRes, tokensRes] = await Promise.all([
    db.from('passport_pages').select('passport_id, prize_description').in('passport_id', ownedIds),
    db.from('acquisitions').select('passport_id').in('passport_id', ownedIds),
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

  return owned.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    is_published: p.is_published,
    prizeTexts: prizesByPassport.get(p.id) ?? [],
    acquisitionCount: acqByPassport.get(p.id) ?? 0,
    prizeDistributedCount: distByPassport.get(p.id) ?? 0,
  }))
}
