// Shared template types for the sample-passport seeder.
//
// `kind` maps directly to the canonical verification model from
// migration 046 — see scripts/seed-sample-passports.ts mapKindToVerification.
// The seeder NEVER sets `verification_tier` directly; the BEFORE INSERT
// trigger sync_verification_tier_from_method() derives it from
// experience_type + experience_verification_method.

// Two distinct vocabularies live in the DB and the designer code:
//
//   StopSpendTier      — per-stop, capped at 50_plus (open-ended).
//                        Defined by stops_expected_spend_tier_check
//                        (migration 047).
//   PassportSpendTier  — whole-trip, finer resolution at the top end.
//                        Defined by lib/design/spend-tiers.ts +
//                        passports_expected_spend_tier_check.
//
// They DO NOT share a vocabulary (migration 047's comment claimed
// they did — that comment predated lib/design/spend-tiers.ts adding
// the higher buckets). Keep them as separate union types so the
// compiler catches passport-level values used on a stop and vice
// versa.

export type StopSpendTier =
  | 'free'
  | 'under_5'
  | '5_to_15'
  | '15_to_50'
  | '50_plus'

export type PassportSpendTier =
  | 'free'
  | 'under_15'
  | '15_50'
  | '50_150'
  | '150_500'
  | '500_plus'

// Backwards-compat alias for templates that already use the
// stop-level name (e.g. bainbridge.ts). Same set of values.
export type SpendTier = StopSpendTier

export type PassportType = 'location' | 'experience' | 'learning'

// Structured address — set the fields you know, leave the rest undefined.
// The seeder defaults country to 'USA' when any other address field is
// present and country is omitted. Override per stop for international.
export interface AddressFields {
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

interface StopBase {
  name: string
  spend?: StopSpendTier
}

interface PhysicalStopBase extends StopBase {
  address?: AddressFields
  lat?: number | null
  lng?: number | null
  /** Free-form place query the seeder resolves via server-side
   *  Geocoding at run time, filling whichever of address / lat / lng
   *  aren't explicitly set. Example: 'Bainbridge Island Museum of
   *  Art, Bainbridge Island, WA'. Skipped when GOOGLE_MAPS_SERVER_KEY
   *  isn't set — the row is still seeded with whatever fields the
   *  template did include (or null).
   *  Explicit address / lat / lng on the same stop WIN over
   *  resolution, so a template can override the geocoder when it
   *  knows better. */
  place?: string
}

export type StopTemplate =
  | (PhysicalStopBase & { kind: 'gps'; radius?: number })
  | (PhysicalStopBase & { kind: 'qr' })
  | (StopBase         & { kind: 'honor'; note?: string })

export interface PageTemplate {
  title: string
  subtitle?: string
  stops: StopTemplate[]
}

export interface PassportTemplate {
  title: string
  description?: string
  passportType: PassportType
  expectedSpendTier?: PassportSpendTier
  expectedSpendNote?: string
  pages: PageTemplate[]
  /** Optional override of the seeder default. When set true, the
   *  seeder writes is_published=true + status='published' +
   *  published_at=now so the passport lands in Explore immediately.
   *  Image pre-rendering still happens on the first designer-side
   *  Publish click; Explore falls back to live-render until then. */
  isPublished?: boolean
  /** Optional cover emblem (emoji). Defaults to '🧭' in the seeder
   *  when unset. */
  coverEmblem?: string
}
