import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectRoles } from '@/lib/roles'
import { StopsClient } from './StopsClient'
import type { DraftPassport, StopCardData } from './types'

export const metadata = { title: 'Stop Library — okuji' }

/**
 * /stops — Stop Library, two-phase rewrite.
 *
 * Server-side: auth, scope detection (am I institutional?
 * needed for "Shared by me"), and a batched fetch of:
 *   - every shared stop (is_shared = true)
 *   - acknowledgment counts per stop
 *   - my-acknowledgment state per stop
 *   - import counts per stop
 *   - my draft passports (for the import target picker)
 *
 * Projects to StopCardData[] and hands off to the client tree.
 * No URL params consumed here — the client owns search /
 * filter / sort / selection state.
 */
export default async function StopLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/stops')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ── Role detection ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleContext = await detectRoles(supabase as any, user.id)
  const isInstitutional =
    roleContext.roles.includes('institutional_manager') ||
    roleContext.roles.includes('institutional_employee')

  // ── Shared stops ──
  // Pull every is_shared stop with its educational metadata
  // and the joins needed for attribution. The page_id walks
  // up to passports → institutions for the institution name;
  // creator joins to profiles for the display name.
  const { data: stopsRaw } = await db
    .from('stops')
    .select(`
      id, name,
      experience_type, experience_verification_method,
      address_city, address_state, address_country,
      classifiers, grade_levels, subject_areas,
      learning_objective, journal_prompt,
      creator_id, created_at,
      creator:profiles!creator_id (display_name),
      page:passport_pages!page_id (
        passport:passports!passport_id (
          institution:institutions!proprietor_id (id, name)
        )
      )
    `)
    .eq('is_shared', true)
    .order('created_at', { ascending: false })

  const stops = (stopsRaw ?? []) as Array<{
    id: string
    name: string
    experience_type: 'location' | 'experience' | null
    experience_verification_method: 'gps' | 'qr' | 'witnessed' | 'documented' | 'honor' | null
    address_city: string | null
    address_state: string | null
    address_country: string | null
    classifiers: string[] | null
    grade_levels: string[] | null
    subject_areas: string[] | null
    learning_objective: string | null
    journal_prompt: string | null
    creator_id: string | null
    created_at: string
    creator: { display_name: string | null } | null
    page: { passport: { institution: { id: string; name: string | null } | null } | null } | null
  }>
  const stopIds = stops.map((s) => s.id)

  // ── Acknowledgment counts + my state ──
  // Two queries, both fast: COUNT(*) per stop_id and the rows
  // where user_id = me. Aggregation in JS.
  const ackCounts = new Map<string, number>()
  const ackByMe = new Set<string>()
  if (stopIds.length > 0) {
    const [{ data: ackAll }, { data: ackMine }] = await Promise.all([
      db.from('stop_acknowledgments').select('stop_id').in('stop_id', stopIds),
      db.from('stop_acknowledgments').select('stop_id').in('stop_id', stopIds).eq('user_id', user.id),
    ])
    for (const r of (ackAll ?? []) as { stop_id: string }[]) {
      ackCounts.set(r.stop_id, (ackCounts.get(r.stop_id) ?? 0) + 1)
    }
    for (const r of (ackMine ?? []) as { stop_id: string }[]) {
      ackByMe.add(r.stop_id)
    }
  }

  // ── Import counts ──
  // Per migration 058 — distinct copies made of each source.
  // The same COUNT(*) shape as acknowledgments.
  const importCounts = new Map<string, number>()
  if (stopIds.length > 0) {
    const { data: impRows } = await db
      .from('stop_imports')
      .select('source_stop_id')
      .in('source_stop_id', stopIds)
    for (const r of (impRows ?? []) as { source_stop_id: string }[]) {
      importCounts.set(r.source_stop_id, (importCounts.get(r.source_stop_id) ?? 0) + 1)
    }
  }

  // ── My imports (for the "My imports" tab) ──
  // The targets of imports I made. Empty until imports start
  // being recorded post-058; that's expected.
  const { data: myImportRows } = await db
    .from('stop_imports')
    .select('source_stop_id, imported_at')
    .eq('importer_id', user.id)
  const mySourceIds = new Set(
    ((myImportRows ?? []) as { source_stop_id: string }[]).map((r) => r.source_stop_id),
  )

  // ── My institution ids (for "Shared by me" tab) ──
  // Stops where the parent passport's proprietor is one of
  // my institutions count as "shared by me" — the spec is
  // institution-gated, so a member of an institution sees
  // everything that institution shared.
  let mySharedIds = new Set<string>()
  if (isInstitutional) {
    const { data: myInstRows } = await db
      .from('employee_authorizations')
      .select('institution_id')
      .eq('user_id', user.id)
    const myInstSet = new Set(
      ((myInstRows ?? []) as { institution_id: string }[]).map((r) => r.institution_id),
    )
    // Direct ownership: institutions.id = user.id
    myInstSet.add(user.id)
    mySharedIds = new Set(
      stops
        .filter((s) => s.page?.passport?.institution?.id && myInstSet.has(s.page.passport.institution.id))
        .map((s) => s.id),
    )
  }

  // ── Draft passports for the import target picker ──
  // Stops import into a passport the user OWNS. Drafts come
  // first (unpublished); published passports are still
  // selectable targets — the user might be iterating on a
  // published copy.
  const { data: passportRows } = await db
    .from('passports')
    .select('id, title')
    .eq('creator_id', user.id)
    .order('updated_at', { ascending: false })
  const drafts: DraftPassport[] = ((passportRows ?? []) as { id: string; title: string | null }[])
    .map((p) => ({ id: p.id, title: p.title ?? 'Untitled passport' }))

  // ── Projection ──
  const rows: StopCardData[] = stops.map((s) => ({
    id: s.id,
    name: s.name,
    experience_type: s.experience_type,
    experience_verification_method: s.experience_verification_method,
    address_city: s.address_city,
    address_state: s.address_state,
    address_country: s.address_country,
    classifiers: s.classifiers ?? [],
    grade_levels: s.grade_levels ?? [],
    subject_areas: s.subject_areas ?? [],
    learning_objective: s.learning_objective,
    journal_prompt: s.journal_prompt,
    creator_id: s.creator_id,
    creator_name: s.creator?.display_name ?? null,
    institution_id: s.page?.passport?.institution?.id ?? null,
    institution_name: s.page?.passport?.institution?.name ?? null,
    acknowledgment_count: ackCounts.get(s.id) ?? 0,
    acknowledged_by_me: ackByMe.has(s.id),
    import_count: importCounts.get(s.id) ?? 0,
    created_at: s.created_at,
  }))

  return (
    <main className="min-h-screen bg-surface-workspace">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-5">
          <h1 className="text-[25px] font-bold text-ink" style={{ letterSpacing: '-0.01em' }}>
            Stop Library
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Educational stops shared by institutions — reuse another teacher&rsquo;s in your own passport.
          </p>
        </header>

        <StopsClient
          stops={rows}
          drafts={drafts}
          mySharedIds={Array.from(mySharedIds)}
          myImportedSourceIds={Array.from(mySourceIds)}
          isInstitutional={isInstitutional}
        />
      </div>
    </main>
  )
}
