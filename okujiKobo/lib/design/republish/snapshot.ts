/**
 * Passport-published-snapshot shape + capture helpers.
 *
 * One snapshot per publish/republish event. The schema below
 * mirrors `passport_published_snapshots.snapshot` (migration
 * 063) and is what the diff engine consumes.
 *
 * IMPORTANT: this is the source of truth for the snapshot
 * shape. Adding a field here without also reading it in
 * `diff.ts` is harmless (it just gets archived for future
 * comparisons); the inverse — reading a field in `diff.ts`
 * that the capture path doesn't populate — silently fails
 * the diff. Keep the two files in lockstep.
 */

// The supabase-js generated `Database` type doesn't structurally
// match the bare `SupabaseClient` signature when narrowed by SSR
// helpers — see lib/dashboard/load.ts for the same pattern.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export interface SnapshotPassport {
  id: string
  title: string
  description: string | null
  price_cents: number | null
  expected_spend_tier: string | null
  cover_image_url: string | null
  // page_image_urls is a jsonb array on the row; we keep it
  // here for completeness even though it's not in any diff
  // category (Explore-side artifact, not a holder-visible
  // field).
  page_image_urls: unknown | null
}

export interface SnapshotPage {
  id: string
  page_order: number
  title: string | null
  /** When non-null, the page was soft-closed (migration 020).
   *  The republish diff treats a snapshot→next transition of
   *  closed_at NULL → non-NULL as a 'page_closure' change. The
   *  snapshot includes ALL pages including closed ones so the
   *  diff sees the closure event. */
  closed_at: string | null
}

export interface SnapshotStop {
  id: string
  page_id: string
  stop_order: number
  // — Location category —
  lat: number | null
  lng: number | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  country: string | null
  // — Verification category —
  experience_type: string | null
  experience_verification_method: string | null
  verification_tier: number | null
  verification_radius_meters: number | null
  qr_code_token: string | null
  // — Closure category —
  closed_at: string | null
  // — Factual-text category (conservative scope per spec) —
  name: string
  learning_objective: string | null
  journal_prompt: string | null
}

export interface PassportSnapshot {
  passport: SnapshotPassport
  pages: SnapshotPage[]
  stops: SnapshotStop[]
}

/**
 * Captures the CURRENT live state of a passport as a
 * snapshot. Used at publish time and at every successful
 * republish.
 *
 * Caller is responsible for the WRITE — this helper only
 * builds the payload from the live rows. The route writes
 * via service-role (RLS on the snapshots table is
 * INSERT-deny).
 */
export async function captureLiveSnapshot(
  supabase: AnySupabase,
  passportId: string,
): Promise<PassportSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: passportRow, error: pErr } = await db
    .from('passports')
    .select('id, title, description, price_cents, expected_spend_tier, cover_image_url, page_image_urls')
    .eq('id', passportId)
    .single()
  if (pErr || !passportRow) {
    throw new Error(`snapshot: passport ${passportId} not readable (${pErr?.message ?? 'no row'})`)
  }

  const { data: pageRows, error: pgErr } = await db
    .from('passport_pages')
    // closed_at included: the diff engine needs to see closure
    // events (snapshot null → next non-null). NO `WHERE
    // closed_at IS NULL` filter — capture the full state.
    .select('id, page_order, title, closed_at')
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true })
  if (pgErr) throw new Error(`snapshot: pages — ${pgErr.message}`)

  const pageIds = ((pageRows ?? []) as SnapshotPage[]).map((p) => p.id)

  const { data: stopRows, error: stErr } = pageIds.length === 0
    ? { data: [], error: null }
    : await db
        .from('stops')
        .select(`
          id, page_id, stop_order,
          lat, lng,
          address_street, address_city, address_state, address_zip, country,
          experience_type, experience_verification_method,
          verification_tier, verification_radius_meters,
          qr_code_token,
          closed_at,
          name, learning_objective, journal_prompt
        `)
        .in('page_id', pageIds)
  if (stErr) throw new Error(`snapshot: stops — ${stErr.message}`)

  return {
    passport: passportRow as SnapshotPassport,
    pages:    (pageRows ?? []) as SnapshotPage[],
    stops:    (stopRows ?? []) as SnapshotStop[],
  }
}

/**
 * Reads the most recent snapshot for a passport, or null if
 * none exists (first-ever publish path).
 */
export async function readLatestSnapshot(
  supabase: AnySupabase,
  passportId: string,
): Promise<PassportSnapshot | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('passport_published_snapshots')
    .select('snapshot')
    .eq('passport_id', passportId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`snapshot read: ${error.message}`)
  if (!data) return null
  return (data as { snapshot: PassportSnapshot }).snapshot
}
