// Shared template types for the sample-passport seeder.
//
// `kind` maps directly to the canonical verification model from
// migration 046 — see scripts/seed-sample-passports.ts mapKindToVerification.
// The seeder NEVER sets `verification_tier` directly; the BEFORE INSERT
// trigger sync_verification_tier_from_method() derives it from
// experience_type + experience_verification_method.

export type SpendTier = 'free' | 'under_5' | '5_to_15' | '15_to_50' | '50_plus'

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
  spend?: SpendTier
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
  expectedSpendTier?: SpendTier
  expectedSpendNote?: string
  pages: PageTemplate[]
}
