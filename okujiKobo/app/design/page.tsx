import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { OkujiDesignerWordmark } from '@/components/design/OkujiDesignerWordmark'
import { MyPassportsTable, type PassportRow } from '@/components/design/MyPassportsTable'
import type { DesignerPassport } from '@/lib/design/types'

export const metadata = { title: 'My passports — okuji Designer' }

// ── Draft completion heuristic ────────────────────────────────────────────────
// Six steps tracked: cover, pages, pins, theme, pricing, publish. Each step
// "done" is a defensive but generous check — anything beyond the seed default
// counts. Drafts surface this in the Performance cell so the creator knows
// where they are in the workshop without opening the editor.
function countDraftSteps(
  passport: DesignerPassport,
  pageCount: number,
  pinCount: number,
): number {
  let done = 0

  // Cover: any image OR custom outside-cover data OR a non-default front bg.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outside = (passport as any).cover_outside_data as { image_url?: string | null; front_bg?: string | null } | null
  const hasCover =
    !!passport.cover_image_url ||
    !!passport.cover_thumbnail ||
    !!(outside?.image_url) ||
    !!(outside?.front_bg && outside.front_bg !== '0D1B2A')
  if (hasCover) done++

  // Pages: at least one user-added page.
  if (pageCount > 0) done++

  // Pins: at least one stop with location data (or any stop on an info-only
  // book; we just count "any stop attached to any page of this passport").
  if (pinCount > 0) done++

  // Theme: paper color or pattern color customised (any non-default).
  if (
    (passport.cover_paper_color && passport.cover_paper_color !== 'F5F2EC') ||
    (passport.cover_bg_color && passport.cover_bg_color !== '0D1B2A')
  ) done++

  // Pricing: expected spend tier explicitly chosen.
  if (passport.expected_spend_tier) done++

  // Publish: only true for already-published passports — drafts can't have
  // this. Still counted so a freshly-unarchived draft can read 6/6.
  if (passport.status === 'published') done++

  return done
}

export default async function DesignIndexPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Platform-admin gate for the destructive "Force delete" action in the
  // row ⋯ menu (force_purge_passport, migration 094/095). Same canonical
  // check the server routes use (invariant #4); regular creators get false
  // and never see the option.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
  const isAdmin = isAdminRpc === true

  // Surface isolation: the okuji designer lists ONLY persistent passports.
  // moichido cards (credential_type='consumable') live on the moichido surface
  // and must never appear here — credential_type is the leak-guard the listing
  // queries gate on (migration 069). NOT NULL DEFAULT 'persistent', so this
  // keeps every okuji passport and excludes every card.
  const { data: passports } = await supabase
    .from('passports')
    .select('*')
    .eq('creator_id', user.id)
    .eq('credential_type', 'persistent')
    .order('updated_at', { ascending: false })

  const list = (passports ?? []) as DesignerPassport[]
  const ids = list.map((p) => p.id)

  // Pre-fetch stats for the table in three batches. RLS handles
  // ownership; we never request another user's collectors / tokens.
  let pageCounts = new Map<string, number>()
  let pinCounts = new Map<string, number>()
  let soldCounts = new Map<string, number>()
  let prizeCounts = new Map<string, number>()

  if (ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const [pagesRes, stopsRes, collectorsRes, tokensRes] = await Promise.all([
      db.from('passport_pages').select('passport_id').in('passport_id', ids),
      // stops live on pages — round-trip via the page list. Doing this in
      // two hops keeps RLS predictable; the alternative is a SQL view we
      // don't have yet.
      db
        .from('passport_pages')
        .select('id, passport_id, stops:stops(id)')
        .in('passport_id', ids),
      db.from('collector_passports').select('passport_id').in('passport_id', ids),
      db
        .from('completion_tokens')
        .select('passport_id, prize_distributed')
        .in('passport_id', ids)
        .eq('prize_distributed', true),
    ])

    for (const r of (pagesRes.data ?? []) as { passport_id: string }[]) {
      pageCounts.set(r.passport_id, (pageCounts.get(r.passport_id) ?? 0) + 1)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (stopsRes.data ?? []) as { passport_id: string; stops: any[] }[]) {
      pinCounts.set(r.passport_id, (pinCounts.get(r.passport_id) ?? 0) + (r.stops?.length ?? 0))
    }
    for (const r of (collectorsRes.data ?? []) as { passport_id: string }[]) {
      soldCounts.set(r.passport_id, (soldCounts.get(r.passport_id) ?? 0) + 1)
    }
    for (const r of (tokensRes.data ?? []) as { passport_id: string }[]) {
      prizeCounts.set(r.passport_id, (prizeCounts.get(r.passport_id) ?? 0) + 1)
    }
  }

  const rows: PassportRow[] = list.map((p) => ({
    passport: p,
    soldCount:   soldCounts.get(p.id)  ?? 0,
    prizesCount: prizeCounts.get(p.id) ?? 0,
    draftStepsDone: countDraftSteps(p, pageCounts.get(p.id) ?? 0, pinCounts.get(p.id) ?? 0),
  }))

  return (
    <div className="min-h-screen bg-surface-workspace">
      {/* Top bar */}
      <header className="border-b border-hairline bg-surface-chrome px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <OkujiDesignerWordmark />
          <Link
            href="/"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            ← Back to okuji
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-10">
        <MyPassportsTable rows={rows} isAdmin={isAdmin} />
      </main>
    </div>
  )
}
