import { redirect } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
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
  // Flat fetch + manual hydration of parents. The earlier
  // version used nested PostgREST embeds (page →passport →
  // creator/institution); embeds were silently returning no
  // rows for shared stops authored by individual users
  // (e.g. proprietor_id is NULL → the embed-syntax FK hint
  // tripped) and the page rendered empty even when
  // is_shared=true rows existed. Doing it as separate IN()
  // fetches keyed on collected ids is dumber but cannot fail
  // for join-syntax reasons.
  const { data: stopsRaw, error: stopsErr } = await db
    .from('stops')
    .select(`
      id, name, page_id,
      experience_type, experience_verification_method,
      address_city, address_state, country,
      classifiers, grade_levels, subject_areas,
      learning_objective, journal_prompt,
      created_at
    `)
    .eq('is_shared', true)
    .order('created_at', { ascending: false })

  if (stopsErr) {
    console.error('[stops/page] shared-stops fetch failed:', stopsErr.message)
  }

  const stops = (stopsRaw ?? []) as Array<{
    id: string
    name: string
    page_id: string | null
    experience_type: 'location' | 'experience' | null
    experience_verification_method: 'gps' | 'qr' | 'witnessed' | 'documented' | 'honor' | null
    address_city: string | null
    address_state: string | null
    country: string | null
    classifiers: string[] | null
    grade_levels: string[] | null
    subject_areas: string[] | null
    learning_objective: string | null
    journal_prompt: string | null
    created_at: string
  }>
  const stopIds = stops.map((s) => s.id)

  // ── Hydrate parents (pages → passports → creators + institutions) ──
  // Three IN() fetches in series, each keyed on the ids
  // discovered by the previous step. Each is a tiny lookup —
  // the stop set is at most a few hundred rows.
  const pageIds = Array.from(
    new Set(stops.map((s) => s.page_id).filter((v): v is string => !!v)),
  )
  const pageRows = pageIds.length === 0 ? [] : (
    ((await db
      .from('passport_pages')
      .select('id, passport_id')
      .in('id', pageIds)
    ).data ?? []) as { id: string; passport_id: string }[]
  )
  const passportIdByPageId = new Map(pageRows.map((r) => [r.id, r.passport_id]))

  const passportIds = Array.from(new Set(pageRows.map((r) => r.passport_id)))
  const parentPassports = passportIds.length === 0 ? [] : (
    ((await db
      .from('passports')
      .select('id, creator_id, proprietor_id')
      .in('id', passportIds)
    ).data ?? []) as { id: string; creator_id: string | null; proprietor_id: string | null }[]
  )
  const passportById = new Map(parentPassports.map((p) => [p.id, p]))

  const creatorIds = Array.from(new Set(
    parentPassports.map((p) => p.creator_id).filter((v): v is string => !!v),
  ))
  const institutionIds = Array.from(new Set(
    parentPassports.map((p) => p.proprietor_id).filter((v): v is string => !!v),
  ))
  const [profileRowsRes, institutionRowsRes] = await Promise.all([
    creatorIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('profiles').select('id, display_name').in('id', creatorIds),
    institutionIds.length === 0
      ? Promise.resolve({ data: [] })
      : db.from('institutions').select('id, name').in('id', institutionIds),
  ])
  const displayNameById = new Map(
    ((profileRowsRes.data ?? []) as { id: string; display_name: string | null }[])
      .map((p) => [p.id, p.display_name]),
  )
  const institutionNameById = new Map(
    ((institutionRowsRes.data ?? []) as { id: string; name: string | null }[])
      .map((i) => [i.id, i.name]),
  )

  function lookupParents(stopPageId: string | null): {
    creator_id: string | null
    creator_name: string | null
    institution_id: string | null
    institution_name: string | null
  } {
    if (!stopPageId) return { creator_id: null, creator_name: null, institution_id: null, institution_name: null }
    const passportId = passportIdByPageId.get(stopPageId)
    if (!passportId) return { creator_id: null, creator_name: null, institution_id: null, institution_name: null }
    const passport = passportById.get(passportId)
    if (!passport) return { creator_id: null, creator_name: null, institution_id: null, institution_name: null }
    return {
      creator_id: passport.creator_id,
      creator_name: passport.creator_id ? displayNameById.get(passport.creator_id) ?? null : null,
      institution_id: passport.proprietor_id,
      institution_name: passport.proprietor_id ? institutionNameById.get(passport.proprietor_id) ?? null : null,
    }
  }

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

  // ── Comment counts ──
  // Per migration 060. Cheap COUNT-by-stop_id via the
  // already-existing index; full bodies are fetched per-stop
  // when the preview drawer opens.
  const commentCounts = new Map<string, number>()
  if (stopIds.length > 0) {
    const { data: cmtRows } = await db
      .from('stop_comments')
      .select('stop_id')
      .in('stop_id', stopIds)
    for (const r of (cmtRows ?? []) as { stop_id: string }[]) {
      commentCounts.set(r.stop_id, (commentCounts.get(r.stop_id) ?? 0) + 1)
    }
  }

  // ── Can-write-comments for the current viewer ──
  // The DB policy is the source of truth (migration 060);
  // this client-side derivation lets the drawer hide the
  // compose UI cleanly instead of letting the user type
  // something only to be rejected on POST. Population:
  // institutional_manager OR institutional_employee OR
  // is_platform_admin.
  const canWriteComments =
    roleContext.roles.includes('institutional_manager') ||
    roleContext.roles.includes('institutional_employee') ||
    roleContext.roles.includes('platform_admin')

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
        .filter((s) => {
          const parents = lookupParents(s.page_id)
          return parents.institution_id !== null && myInstSet.has(parents.institution_id)
        })
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
  const rows: StopCardData[] = stops.map((s) => {
    const parents = lookupParents(s.page_id)
    return {
      id: s.id,
      name: s.name,
      experience_type: s.experience_type,
      experience_verification_method: s.experience_verification_method,
      address_city: s.address_city,
      address_state: s.address_state,
      address_country: s.country,
      classifiers: s.classifiers ?? [],
      grade_levels: s.grade_levels ?? [],
      subject_areas: s.subject_areas ?? [],
      learning_objective: s.learning_objective,
      journal_prompt: s.journal_prompt,
      creator_id: parents.creator_id,
      creator_name: parents.creator_name,
      institution_id: parents.institution_id,
      institution_name: parents.institution_name,
      acknowledgment_count: ackCounts.get(s.id) ?? 0,
      acknowledged_by_me: ackByMe.has(s.id),
      import_count: importCounts.get(s.id) ?? 0,
      comment_count: commentCounts.get(s.id) ?? 0,
      created_at: s.created_at,
    }
  })

  return (
    <div className="min-h-screen bg-surface-workspace">
      <AppNav />

      <main className="mx-auto max-w-7xl px-6 py-8">
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
          canWriteComments={canWriteComments}
        />
      </main>
    </div>
  )
}
