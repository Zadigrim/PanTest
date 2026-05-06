// ── Design-specific type extensions for the passport designer ─────────────────
// These types are more granular than PanoplyConnect's lib/supabase/types.ts
// and are used exclusively by the designer route group.

export type SpendTier = 'free' | 'under_15' | '15_50' | '50_150' | '150_500' | '500_plus'
export type PageElementType = 'text' | 'hline' | 'vline'

export interface DesignerPageElement {
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
  fontFamily?: string
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
export type CreatorDecision = 'accepted' | 'adjusted' | 'overridden'
export type PrintJournalSetting = 'include_all' | 'exclude_all' | 'per_stop'

export interface CoverSideData {
  front_bg: string       // hex without #, default '0D1B2A'
  back_bg: string        // hex without #, default '0D1B2A'
  image_url: string | null
  image_opacity: number  // 10–100
  // Position as fraction of canvas dimensions (0 = top/left, stored on save)
  image_position_x: number  // default 0.5 (centred)
  image_position_y: number  // default 0.5 (centred)
  image_scale: number        // 1.0 = fit, >1 = zoomed in; default 1
}

export interface DesignerPassport {
  id: string
  creator_id: string
  institution_id: string | null
  proprietor_id: string | null
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
  print_enabled: boolean
  print_journal_setting: PrintJournalSetting
  cover_outside_data: CoverSideData | null
  cover_inside_data: CoverSideData | null
  cover_thumbnail: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface DesignerPassportPage {
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
  elements: DesignerPageElement[]
  created_at: string
}

export interface DesignerStop {
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
  // Educational fields (migration 004)
  classifiers: string[]
  grade_levels: string[]
  subject_areas: string[]
  journal_prompt: string | null
  // Print for kids (migration 005)
  print_include_journal: boolean
  created_at: string
}
