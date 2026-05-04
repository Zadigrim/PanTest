export type SpendTier = 'free' | 'under_15' | '15_50' | '50_150' | '150_500' | '500_plus'
export type PageElementType = 'text' | 'hline' | 'vline'

export interface PageElement {
  id: string
  type: PageElementType
  x: number
  y: number
  width: number
  height: number
  // text
  content?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  color?: string
  align?: 'left' | 'center' | 'right'
  // line
  thickness?: number
  lineColor?: string
}
export type PassportStatus = 'draft' | 'published' | 'archived'
export type PassportType = 'location' | 'experience' | 'learning'
export type BackgroundType = 'guilloche' | 'landscape' | 'none' | 'custom'
export type SmudgeIntensity = 'none' | 'light' | 'medium' | 'heavy'
export type ExperienceType = 'location' | 'experience'
export type ExperienceVerification = 'witnessed' | 'documented' | 'presence' | 'honor'
export type InstitutionType = 'school' | 'library' | 'tourism_board' | 'proprietor' | 'other'
export type CertModule = 'backgrounds' | 'typography' | 'stamps' | 'architecture' | 'covers'
export type CreatorDecision = 'accepted' | 'adjusted' | 'overridden'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  role: string
  pro_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  slug: string
  type: InstitutionType
  logo_url: string | null
  admin_user_id: string | null
  created_at: string
}

export interface Passport {
  id: string
  creator_id: string
  institution_id: string | null
  title: string
  description: string | null
  cover_template: string
  cover_paper_color: string
  cover_bg_color: string
  cover_emblem: string | null
  passport_type: PassportType
  status: PassportStatus
  price_cents: number
  expected_spend_tier: SpendTier | null
  expected_spend_note: string | null
  transit_accessible: boolean
  wheelchair_accessible: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface PassportPage {
  id: string
  passport_id: string
  page_number: number | null
  page_order: number
  section_name: string
  section_title: string | null
  section_subtitle: string | null
  prize_description: string | null
  prize_location_constraint: string | null
  background_type: BackgroundType
  background_color: string
  background_opacity: number
  paper_color: string
  elements: PageElement[]
  created_at: string
}

export interface Stop {
  id: string
  page_id: string
  stop_order: number
  stop_number: number | null
  name: string
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  lat: number | null
  lng: number | null
  geohash: string | null
  verification_tier: number
  verification_radius_meters: number
  qr_code_token: string | null
  stamp_icon: string
  stamp_color: string
  stamp_rotation_fixed: number | null
  stamp_rotation_min: number
  stamp_rotation_max: number
  smudge_intensity: SmudgeIntensity
  box_x: number | null
  box_y: number | null
  box_width: number
  box_height: number
  learning_objective: string | null
  experience_type: ExperienceType | null
  experience_verification_method: ExperienceVerification | null
  created_at: string
}

export interface SpendVerificationLog {
  id: string
  passport_id: string
  requested_tier: SpendTier
  ai_suggested_range_low: number | null
  ai_suggested_range_high: number | null
  ai_reasoning: string | null
  creator_decision: CreatorDecision | null
  created_at: string
}

export interface CreatorCertification {
  id: string
  user_id: string
  module: CertModule
  completed_at: string | null
  portfolio_page_id: string | null
}

// Minimal Database type for Supabase client typing
export interface Database {
  public: {
    Tables: {
      profiles:                  { Row: Profile }
      institutions:              { Row: Institution }
      passports:                 { Row: Passport }
      passport_pages:            { Row: PassportPage }
      stops:                     { Row: Stop }
      spend_verification_log:    { Row: SpendVerificationLog }
      creator_certifications:    { Row: CreatorCertification }
    }
  }
}
