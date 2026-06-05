/**
 * Shared types for the /access master/detail surface.
 *
 * The server page projects profiles + institutions into the
 * unified AccessEntityRow shape; the client orchestrator works
 * with rows + a selection.
 */

export type AccessKind = 'person' | 'institution'

/**
 * One row in the left list. Carries enough information for the
 * row chip + the toolbar's filter / sort to operate without the
 * client re-fetching anything. `raw` keeps the original row so
 * the detail panel can read fields the row UI doesn't surface
 * (e.g. role on people, pricing_model on institutions).
 */
export interface AccessEntityRow {
  kind: AccessKind
  id: string
  name: string
  sub: string | null
  /** Display tier — 'studio' | 'pro' for people, or the institution.tier for institutions. */
  tier: string | null
  /** 'comp' | 'paid' on people; null on institutions. */
  tierSource: 'comp' | 'paid' | null
  /** ISO expiry of the active subscription, when present. */
  expiresAt: string | null
  /** Pending transfers this entity is involved in (incoming OR outgoing initiator). */
  transferCount: number
  /** Source row created_at — drives "Recently active" sort. */
  createdAt: string

  // Institution-only — undefined on person rows.
  pricingModel?: string | null
  employeeCount?: number

  /** Original DB row, untyped. The detail panel reads from this
   *  for fields not surfaced on the list row. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

export interface AccessPendingTransfers {
  byPersonId: Record<string, number>
  byInstitutionId: Record<string, number>
}
