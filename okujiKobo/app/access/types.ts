/**
 * Shared types for the /access master/detail surface.
 *
 * The server page projects profiles + institutions into the
 * tab-specific row shapes below; each tab works with its own
 * filtered selection.
 */

export type AccessKind = 'person' | 'institution'

export interface PersonRow {
  id: string
  name: string
  /** Legacy profiles.role text — display-only, never authoritative. */
  legacyRole: string | null
  /** ISO; renders as the Joined column. */
  joinedAt: string
  /** Derived display tier, or null for no active subscription. */
  tier: 'studio' | 'pro' | null
  tierSource: 'comp' | 'paid' | null
  expiresAt: string | null
  isPlatformAdmin: boolean
  transferCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

export interface InstitutionRow {
  id: string
  name: string
  institutionType: string | null
  tier: string | null
  pricingModel: string | null
  /** Computed: 'free-civic' when both tier === 'civic' AND
   *  pricing_model is one of the free models. UI maps to the
   *  "Free · civic (permanent)" pill. */
  accessKind: 'free-civic' | 'commercial' | 'unknown'
  memberCount: number
  passportCount: number
  /** COUNT(acquisitions) over the institution's passports. The
   *  spec calls this "acquired" — never "sold" — because no
   *  payment system exists yet. */
  acquiredCount: number
  transferCount: number
  createdAt: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

export interface AccessPendingTransfers {
  byPersonId: Record<string, number>
  byInstitutionId: Record<string, number>
}
