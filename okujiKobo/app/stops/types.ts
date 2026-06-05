/**
 * Shared types for the Stop Library at /stops.
 *
 * The server page projects shared stops + per-stop acknowledgment
 * counts + my-acknowledgment state + per-stop import counts into
 * the StopCardData shape below; the client tree works off that
 * single payload + the small draft-passport list (for the
 * import target picker).
 */

export interface StopCardData {
  id: string
  name: string

  // Verification model (migration 046)
  experience_type: 'location' | 'experience' | null
  experience_verification_method: 'gps' | 'qr' | 'witnessed' | 'documented' | 'honor' | null

  // Location-only (events have these null by design)
  address_city: string | null
  address_state: string | null
  address_country: string | null

  // Educational metadata
  classifiers: string[]
  grade_levels: string[]
  subject_areas: string[]
  learning_objective: string | null
  journal_prompt: string | null

  // Attribution
  creator_id: string | null
  creator_name: string | null
  institution_id: string | null
  institution_name: string | null

  // Reuse + kudos signals
  acknowledgment_count: number
  /** True iff the current viewer has already acknowledged. */
  acknowledged_by_me: boolean
  import_count: number

  // For sorting / freshness signal
  created_at: string
}

export interface DraftPassport {
  id: string
  title: string
}
