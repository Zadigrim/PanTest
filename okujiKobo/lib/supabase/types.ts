// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole = 'collector' | 'creator' | 'employee' | 'admin'
// Migration 034 dropped the legacy ('community' | 'commercial' | 'enterprise')
// tier and re-added it with this set per DEC-02 / Appendix L.5. Nathan sets
// the tier manually; there is no auto-classification at signup.
export type InstitutionTier = 'civic' | 'municipal' | 'business' | 'pending'

export type InstitutionType =
  // Educational
  | 'k12_school' | 'public_library' | 'museum' | 'educational_nonprofit'
  | 'after_school_program' | 'literacy_organization' | 'youth_development'
  | 'homeschool_cooperative'
  // Cultural preservation
  | 'historical_society' | 'heritage_organization' | 'cultural_center'
  | 'oral_history_project'
  // Community arts
  | 'community_theater' | 'public_art_organization' | 'community_arts_center'
  | 'community_music_program' | 'writing_center'
  // Social services
  | 'food_bank' | 'homeless_shelter' | 'refugee_immigrant_services'
  | 'free_health_clinic' | 'adult_literacy'
  // Environmental / conservation
  | 'parks_department' | 'nature_conservatory' | 'land_trust'
  | 'watershed_council' | 'native_plant_society' | 'wildlife_rehabilitation'
  | 'environmental_education'
  // Nature & science (admission determines pricing)
  | 'zoo' | 'aquarium' | 'botanical_garden' | 'science_museum'
  | 'childrens_museum' | 'nature_center'
  // Community access
  | 'community_garden' | 'maker_space' | 'tool_lending_library' | 'seed_library'
  // Municipal
  | 'municipality'
  // Commercial — community tier
  | 'chamber_of_commerce' | 'local_tourism_board' | 'proprietor' | 'hotel_group_small'
  // Commercial — regional tier
  | 'state_tourism_board' | 'convention_bureau'
  // Commercial — enterprise tier
  | 'hotel_chain' | 'airline' | 'expo_organizer' | 'national_tourism_org'
  | 'theme_park' | 'cruise_line'
  // Patron
  | 'corporate_sponsor' | 'foundation'
  // Legacy (kept for backward compat with existing DB rows)
  | 'nature_center_paid' | 'tourism_board'
  | 'general' | 'library' | 'school' | 'park' | 'historic_site'
  | 'nonprofit' | 'other'

export const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  // Educational
  k12_school:                'K–12 School',
  public_library:            'Public Library',
  museum:                    'Museum',
  educational_nonprofit:     'Educational Nonprofit',
  after_school_program:      'After-School Program',
  literacy_organization:     'Literacy Organization',
  youth_development:         'Youth Development (Scouts, 4-H, etc.)',
  homeschool_cooperative:    'Homeschool Cooperative',
  // Environmental / conservation
  parks_department:          'Parks Department',
  nature_conservatory:       'Nature Conservatory (free access)',
  land_trust:                'Land Trust',
  watershed_council:         'Watershed Council',
  native_plant_society:      'Native Plant Society',
  wildlife_rehabilitation:   'Wildlife Rehabilitation',
  environmental_education:   'Environmental Education',
  // Cultural preservation
  historical_society:        'Historical Society',
  heritage_organization:     'Heritage Organization',
  cultural_center:           'Cultural Center',
  oral_history_project:      'Oral History Project',
  // Community arts
  community_theater:         'Community Theater',
  public_art_organization:   'Public Art Organization',
  community_arts_center:     'Community Arts Center',
  community_music_program:   'Community Music Program',
  writing_center:            'Writing Center',
  // Social services
  food_bank:                 'Food Bank',
  homeless_shelter:          'Homeless Shelter / Housing Nonprofit',
  refugee_immigrant_services:'Refugee & Immigrant Services',
  free_health_clinic:        'Free Health Clinic',
  adult_literacy:            'Adult Literacy / GED Program',
  // Community access
  community_garden:          'Community Garden',
  maker_space:               'Maker Space (free/low-cost)',
  tool_lending_library:      'Tool Lending Library',
  seed_library:              'Seed Library',
  // Municipal
  municipality:              'Municipality (under 25k population)',
  // Nature & science (admission determines pricing)
  zoo:                       'Zoo',
  aquarium:                  'Aquarium',
  botanical_garden:          'Botanical Garden',
  science_museum:            'Science Museum',
  childrens_museum:          'Children\'s Museum',
  nature_center:             'Nature Center',
  // Commercial — community tier
  chamber_of_commerce:       'Chamber of Commerce',
  local_tourism_board:       'Local Tourism Board',
  proprietor:                'Proprietor / McMenamins-type',
  hotel_group_small:         'Hotel Group (small / independent)',
  // Commercial — regional tier
  state_tourism_board:       'State Tourism Board',
  convention_bureau:         'Convention & Visitors Bureau',
  // Commercial — enterprise tier
  hotel_chain:               'Hotel Chain',
  airline:                   'Airline',
  expo_organizer:            'Expo / Conference Organizer',
  national_tourism_org:      'National Tourism Organization',
  theme_park:                'Theme Park',
  cruise_line:               'Cruise Line',
  // Patron
  corporate_sponsor:         'Corporate Sponsor',
  foundation:                'Foundation',
  other:                     'Other',
  // Legacy
  nature_center_paid:        'Nature Center (admission-charging)',
  tourism_board:             'Tourism Board',
  general:                   'General',
  library:                   'Library',
  school:                    'School',
  park:                      'Park',
  historic_site:             'Historic Site',
  nonprofit:                 'Nonprofit',
}

// Pricing logic has moved to lib/pricing.ts — import from there.
export type PassportType = 'location' | 'experience' | 'learning'
export type PassportStatus = string // open-ended; tighten if values are known
export type TravelerType = string   // open-ended; tighten if values are known
export type ExperienceType = 'location' | 'experience' | null
export type ExperienceVerificationMethod =
  | 'witnessed'
  | 'documented'
  | 'presence'
  | 'honor'
  | null
export type BackgroundType = string  // open-ended; tighten if values are known
export type EntryType = string       // open-ended; tighten if values are known

// ---------------------------------------------------------------------------
// Core tables
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  bio: string | null
  website_url: string | null
  stripe_connect_account_id: string | null
  date_of_birth: string | null        // ISO date string (YYYY-MM-DD)
  traveler_type: TravelerType | null
  pro_expires_at: string | null       // ISO timestamp
  is_platform_admin: boolean
  connect_roles: string[] | null
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  tier: InstitutionTier
  institution_type: InstitutionType | null
  charges_admission: boolean
  pricing_model: 'free' | 'paid_passport' | 'community' | 'regional' | 'enterprise' | 'patron'
  municipality_population: number | null
  pricing_model_locked: boolean
  pricing_model_override_by: string | null
  pricing_model_override_at: string | null
  pricing_model_computed: string | null
  catalog_url: string | null
  contact_name: string | null
  contact_email: string | null
  address_line1: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  website: string | null
  internal_notes: string | null
  // Per-institution token-code prefix (migration 032). 1-6 chars,
  // uppercase letters or digits; format enforced by CHECK at the DB layer.
  token_prefix: string
  // Business-tier inputs (migration 041). Captured-only; the pricing
  // function that will consume them is deferred. Both nullable for all
  // tiers; conditionally surfaced in the UI only when tier = 'business'.
  annual_revenue: number | null
  marketing_spend: number | null
  created_at: string
}

export interface Passport {
  id: string
  creator_id: string
  proprietor_id: string | null
  title: string
  description: string | null
  passport_type: PassportType
  cover_bg_color: string | null
  cover_emblem: string | null
  cover_image_url: string | null
  is_published: boolean
  is_free: boolean
  price_cents: number | null
  expected_spend_tier: string | null
  transit_accessible: boolean | null
  wheelchair_accessible: boolean | null
  estimated_hours: number | null
  traveler_types: TravelerType[] | null
  award_year: number | null
  shortlisted: boolean | null
  status: PassportStatus | null
  cover_thumbnail: string | null
  created_at: string
  updated_at: string
}

export interface PassportPage {
  id: string
  passport_id: string
  page_order: number
  section_name: string | null
  section_title: string | null
  section_subtitle: string | null
  prize_description: string | null
  background_type: BackgroundType | null
  background_color: string | null
  background_opacity: number | null
  elements: PageElement[]
  created_at: string
}

// Typed placeholder for page canvas elements.
// Extend this union as element schemas are formalised.
export type PageElement = Record<string, unknown>

export interface Stop {
  id: string
  page_id: string
  stop_order: number
  name: string
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  country: string | null
  location_type: 'address' | 'coordinates' | 'honor' | null
  lat: number | null
  lng: number | null
  verification_tier: number | null
  verification_radius_meters: number | null
  qr_code_token: string | null
  stamp_icon: string | null
  stamp_color: string | null
  stamp_rotation_min: number | null
  stamp_rotation_max: number | null
  smudge_intensity: number | null
  experience_type: ExperienceType
  experience_verification_method: ExperienceVerificationMethod
  learning_objective: string | null
  created_at: string
}

export interface Acquisition {
  id: string
  user_id: string
  passport_id: string
  acquired_at: string
  price_paid_cents: number | null
  stripe_payment_intent_id: string | null
}

export interface Stamp {
  id: string
  user_id: string
  stop_id: string
  passport_id: string
  verified_at: string | null
  verification_method: string | null
  geohash: string | null
  stamp_pos_x: number | null
  stamp_pos_y: number | null
  contact_size_px: number | null
  rotation_deg: number | null
  verifier_id: string | null
  verifier_note: string | null
}

export interface CompletionToken {
  id: string
  user_id: string
  passport_id: string
  page_id: string
  token_code: string
  generated_at: string
  redeemed_at: string | null
  redeemed_by: string | null
  prize_distributed: boolean | null
  distribution_pending: boolean | null
  distribution_logged_at: string | null
  distribution_logged_by: string | null
  prize_note: string | null
}

export interface JournalEntry {
  id: string
  user_id: string
  stamp_id: string | null
  stop_id: string | null
  passport_id: string | null
  entry_type: EntryType | null
  content: string | null
  media_url: string | null
  entry_number: number | null
  context_label: string | null
  recorded_at: string
  is_shared: boolean | null
}

export interface MoodRating {
  id: string
  user_id: string
  stamp_id: string
  rating: number
  rated_at: string
}

export interface EmployeeAuthorization {
  id: string
  institution_id: string
  user_id: string
  role_label: string | null
  can_verify: boolean | null
  can_distribute_prizes: boolean | null
  can_design: boolean | null
  can_manage_employees: boolean | null
  can_view_analytics: boolean | null
  can_manage_billing: boolean | null
  authorized_by: string | null
  authorized_at: string
}

export interface PrizeConfiguration {
  id: string
  page_id: string
  institution_id: string
  prize_description: string | null
  prize_value_cents: number | null
  location_whitelist: string[] | null
  configured_by: string | null
  configured_at: string
}

export interface InstitutionSubscription {
  id: string
  institution_id: string
  tier: InstitutionTier
  monthly_price_cents: number
  stripe_subscription_id: string | null
  started_at: string
  current_period_end: string | null
}

export interface Tip {
  id: string
  from_user_id: string
  passport_id: string
  creator_id: string
  amount_cents: number
  stripe_payment_intent_id: string | null
  note: string | null
  tipped_at: string
}

export interface CreatorQualityScore {
  id: string
  passport_id: string
  computed_at: string
  completion_rate: number | null
  avg_mood_rating: number | null
  return_visit_rate: number | null
  expert_signoff_rate: number | null
  composite_score: number | null
  pool_share_cents: number | null
}

// ---------------------------------------------------------------------------
// Composite / joined types
// ---------------------------------------------------------------------------

export type PassportWithScore = Passport & {
  quality_score?: CreatorQualityScore | null
}

export type PassportWithDetails = Passport & {
  pages_count: number
  stops_count: number
  /** Alias kept for backward compat; same value as stops_count */
  stop_count: number
  creator: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
  institution: Pick<Institution, 'id' | 'name' | 'slug' | 'logo_url'> | null
  quality_score?: CreatorQualityScore | null
  /** True when the creator holds at least one completed certification */
  creator_is_certified: boolean
}

// ---------------------------------------------------------------------------
// Database shape (for createBrowserClient / createServerClient generics)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id'>
        Update: Partial<Profile>
      }
      institutions: {
        Row: Institution
        Insert: Omit<Institution, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Institution>
      }
      passports: {
        Row: Passport
        Insert: Omit<Passport, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Passport>
      }
      passport_pages: {
        Row: PassportPage
        Insert: Omit<PassportPage, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PassportPage>
      }
      stops: {
        Row: Stop
        Insert: Omit<Stop, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Stop>
      }
      acquisitions: {
        Row: Acquisition
        Insert: Omit<Acquisition, 'id' | 'acquired_at'> & { id?: string; acquired_at?: string }
        Update: Partial<Acquisition>
      }
      stamps: {
        Row: Stamp
        Insert: Omit<Stamp, 'id'> & { id?: string }
        Update: Partial<Stamp>
      }
      completion_tokens: {
        Row: CompletionToken
        Insert: Omit<CompletionToken, 'id' | 'generated_at'> & { id?: string; generated_at?: string }
        Update: Partial<CompletionToken>
      }
      journal_entries: {
        Row: JournalEntry
        Insert: Omit<JournalEntry, 'id' | 'recorded_at'> & { id?: string; recorded_at?: string }
        Update: Partial<JournalEntry>
      }
      mood_ratings: {
        Row: MoodRating
        Insert: Omit<MoodRating, 'id' | 'rated_at'> & { id?: string; rated_at?: string }
        Update: Partial<MoodRating>
      }
      employee_authorizations: {
        Row: EmployeeAuthorization
        Insert: Omit<EmployeeAuthorization, 'id' | 'authorized_at'> & { id?: string; authorized_at?: string }
        Update: Partial<EmployeeAuthorization>
      }
      prize_configurations: {
        Row: PrizeConfiguration
        Insert: Omit<PrizeConfiguration, 'id' | 'configured_at'> & { id?: string; configured_at?: string }
        Update: Partial<PrizeConfiguration>
      }
      institution_subscriptions: {
        Row: InstitutionSubscription
        Insert: Omit<InstitutionSubscription, 'id' | 'started_at'> & { id?: string; started_at?: string }
        Update: Partial<InstitutionSubscription>
      }
      tips: {
        Row: Tip
        Insert: Omit<Tip, 'id' | 'tipped_at'> & { id?: string; tipped_at?: string }
        Update: Partial<Tip>
      }
      creator_quality_scores: {
        Row: CreatorQualityScore
        Insert: Omit<CreatorQualityScore, 'id' | 'computed_at'> & { id?: string; computed_at?: string }
        Update: Partial<CreatorQualityScore>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      institution_tier: InstitutionTier
      passport_type: PassportType
      experience_type: NonNullable<ExperienceType>
      experience_verification_method: NonNullable<ExperienceVerificationMethod>
    }
  }
}
