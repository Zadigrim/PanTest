// ── Design-specific type extensions for the passport designer ─────────────────
// These types are more granular than okujiKobo's lib/supabase/types.ts
// and are used exclusively by the designer route group.

export type SpendTier = 'free' | 'under_15' | '15_50' | '50_150' | '150_500' | '500_plus'

// ── Page element types ────────────────────────────────────────────────────────

export type PageElementType = 'text' | 'image' | 'line' | 'hline' | 'vline'

interface BaseBoxElement {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface TextPageElement extends BaseBoxElement {
  type: 'text'
  content?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontFamily?: string
  color?: string
  align?: 'left' | 'center' | 'right'
  rotation?: number   // degrees 0–359, default 0
}

export interface ImagePageElement extends BaseBoxElement {
  type: 'image'
  imageUrl: string
  rotation?: number   // degrees 0–359, default 0
  opacity?: number    // 0–100, default 100
}

export interface LinePageElement {
  id: string
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  thickness?: number
  lineColor?: string  // hex without #, default '0D1B2A'
}

// Legacy types kept for backward-compat rendering of pre-migration data.
export interface HLinePageElement extends BaseBoxElement {
  type: 'hline'
  thickness?: number
  lineColor?: string
}
export interface VLinePageElement extends BaseBoxElement {
  type: 'vline'
  thickness?: number
  lineColor?: string
}

export type DesignerPageElement =
  | TextPageElement
  | ImagePageElement
  | LinePageElement
  | HLinePageElement
  | VLinePageElement

// Type guards
export const isLineEl  = (el: DesignerPageElement): el is LinePageElement  => el.type === 'line'
export const isTextEl  = (el: DesignerPageElement): el is TextPageElement  => el.type === 'text'
export const isImageEl = (el: DesignerPageElement): el is ImagePageElement => el.type === 'image'
export const isBoxEl   = (
  el: DesignerPageElement,
): el is TextPageElement | ImagePageElement | HLinePageElement | VLinePageElement =>
  el.type !== 'line'

// ── Other types ───────────────────────────────────────────────────────────────

export type PassportStatus = 'draft' | 'published' | 'archived'
export type PassportType = 'location' | 'experience' | 'learning'
export type BackgroundType = 'guilloche' | 'landscape' | 'none' | 'custom' | 'grid'
export type SmudgeIntensity = 'none' | 'light' | 'medium' | 'heavy'
export type ExperienceType = 'location' | 'experience'
// Level-2 verification method on the canonical stop model (migration 046).
// Drives the verification_tier value via the sync trigger:
//   'gps'        → tier 3   (GPS-only radius check)
//   'qr'         → tier 2   (QR + GPS)
//   'witnessed'  → tier 4   (employee verification — separate flow)
//   'documented' → tier 5   (verify-stamp bypass; evidence collection
//                            is a separate future flow — flagged as
//                            ambiguous in PR 046's mapping)
//   'honor'      → tier 5   (self-reported bypass; the only valid method
//                            when experience_type='experience')
//   'presence'   → legacy; retained for backward compat with rows
//                  written before 046. New designer code should not
//                  emit this value.
export type ExperienceVerification = 'gps' | 'qr' | 'witnessed' | 'documented' | 'presence' | 'honor'
export type CreatorDecision = 'accepted' | 'adjusted' | 'overridden'
export type PrintJournalSetting = 'include_all' | 'exclude_all' | 'per_stop'

export interface CoverSideData {
  front_bg: string
  back_bg: string
  image_url: string | null
  image_opacity: number
  image_position_x: number
  image_position_y: number
  image_scale: number
  elements: DesignerPageElement[]
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
  // Legacy top-level cover image. Predates cover_outside_data; some
  // passports have their cover ONLY here. Resolver picks it up second.
  cover_image_url: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export type PageType = 'stamp' | 'information'

export interface DesignerPassportPage {
  id: string
  passport_id: string
  page_number: number | null
  page_order: number
  page_type: PageType
  section_name: string
  section_title: string | null
  section_subtitle: string | null
  prize_description: string | null
  prize_location_constraint: string | null
  background_type: BackgroundType
  background_color: string
  background_opacity: number
  background_image_url: string | null
  custom_background_opacity: number   // 0–100, applies when background_type === 'custom'
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
  // International / location-type fields (migration 042).
  // country is free text — no ISO-code enforcement.
  country: string | null
  // RETIRED by migration 046 in favour of (experience_type +
  // experience_verification_method). Designer no longer reads or writes
  // this; the column stays for backward compat with existing rows and
  // will be dropped in a later cleanup once nothing depends on it.
  location_type: 'address' | 'coordinates' | 'honor' | null
  lat: number | null
  lng: number | null
  geohash: string | null
  verification_tier: number
  verification_radius_meters: number
  qr_code_token: string | null   // legacy column name; the live mobile schema uses qr_code_id
  qr_code_id: string | null      // canonical column in production; server-issued per stop
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
  rotation: number              // visual rotation of the location box, 0–359
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
  // Stop library (migration 011)
  is_shared: boolean
  shared_at: string | null
  // Stamp asset (migration 012)
  stamp_asset_id: string | null
  stamp_type: 'emoji' | 'custom_asset'
  created_at: string
}
