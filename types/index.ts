export type Role = 'collector' | 'creator' | 'employee' | 'admin'
export type PassportType = 'location' | 'experience' | 'learning'
export type StampShape = 'circle' | 'rectangle' | 'hexagon' | 'badge'
export type StampSmudge = 'none' | 'light' | 'medium' | 'heavy'
export type VerificationMethod = 'qr_gps' | 'gps_only' | 'employee' | 'self_reported'
export type VerificationType = 'witnessed' | 'documented' | 'presence' | 'honor'
export type InputMethod = 'keyboard' | 'voice' | 'both'
export type ProprietorTier = 'community' | 'commercial' | 'enterprise'
export type CoverBgType = 'color' | 'gradient' | 'image'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  family_id: string | null
  role: Role
  pro_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Proprietor {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: ProprietorTier
  created_at: string
}

export interface EmployeeAccount {
  id: string
  user_id: string
  proprietor_id: string
  employee_name: string
  is_active: boolean
  created_at: string
}

export interface Passport {
  id: string
  creator_id: string
  proprietor_id: string | null
  title: string
  description: string | null
  passport_type: PassportType
  cover_bg_color: string
  cover_bg_type: CoverBgType
  cover_image_url: string | null
  cover_thumbnail: string | null
  cover_emblem: string
  illus_type: string
  illus_color: string
  illus_opacity: number
  paper_color: string
  is_published: boolean
  is_free: boolean
  price_cents: number
  created_at: string
  updated_at: string
}

// ── Designer element types (mirror of OkujiConnect lib/design/types.ts) ────

export interface TextDesignerEl {
  id: string; type: 'text'
  x: number; y: number; width: number; height: number
  content?: string; fontSize?: number; fontWeight?: 'normal' | 'bold'
  fontFamily?: string; color?: string; align?: 'left' | 'center' | 'right'
  rotation?: number
}
export interface ImageDesignerEl {
  id: string; type: 'image'
  x: number; y: number; width: number; height: number
  imageUrl: string; rotation?: number; opacity?: number
}
export interface LineDesignerEl {
  id: string; type: 'line'
  x1: number; y1: number; x2: number; y2: number
  thickness?: number; lineColor?: string
}
export interface HLineDesignerEl {
  id: string; type: 'hline'
  x: number; y: number; width: number; height: number
  thickness?: number; lineColor?: string
}
export interface VLineDesignerEl {
  id: string; type: 'vline'
  x: number; y: number; width: number; height: number
  thickness?: number; lineColor?: string
}
export type PageDesignerElement =
  | TextDesignerEl | ImageDesignerEl | LineDesignerEl | HLineDesignerEl | VLineDesignerEl

export interface PassportPage {
  id: string
  passport_id: string
  page_order: number
  section_name: string
  section_tagline: string | null
  prize_description: string | null
  prize_redeemable_location_ids: string[] | null
  // Designer fields
  paper_color: string | null
  background_type: string | null
  background_color: string | null
  background_opacity: number | null
  background_image_url: string | null
  custom_background_opacity: number | null
  elements: PageDesignerElement[] | null
  section_title: string | null
  section_subtitle: string | null
  created_at: string
}

export interface Stop {
  id: string
  page_id: string
  stop_order: number
  name: string
  year_established: string | null
  location_name: string | null
  description: string | null
  evidence_tier: number
  target_location: unknown | null
  radius_meters: number
  qr_code_id: string | null
  stamp_icon: string
  stamp_color: string
  stamp_shape: StampShape
  stamp_rotation_fixed: number | null
  stamp_rotation_range: number
  stamp_smudge: StampSmudge
  box_x: number | null
  box_y: number | null
  box_width: number
  box_height: number
  rotation: number   // visual rotation of the location box, 0–359 degrees
  verification_type: VerificationType | null
  created_at: string
}

export interface CollectorPassport {
  id: string
  user_id: string
  passport_id: string
  acquired_at: string
  last_used_at: string | null
  completed_at: string | null
}

export interface Stamp {
  id: string
  user_id: string
  stop_id: string
  collector_passport_id: string
  geohash: string | null
  stamp_pos_x: number | null
  stamp_pos_y: number | null
  contact_size_px: number | null
  rotation_deg: number
  verification_method: VerificationMethod
  verifier_id: string | null
  verifier_note: string | null
  stop_opened_at: string | null
  verified_at: string
}

export interface JournalEntry {
  id: string
  stamp_id: string
  user_id: string
  body: string | null
  mood_rating: number | null
  photo_urls: string[]
  input_method: InputMethod
  created_at: string
  updated_at: string
}

export interface RedemptionToken {
  id: string
  user_id: string
  page_id: string
  token_code: string
  scanned_at: string | null
  scanned_by_employee: string | null
  prize_distributed_at: string | null
  prize_given: string | null
  distributed_by: string | null
  distribution_location_id: string | null
  extra_gift_card_cents: number | null
  employee_note: string | null
  distribution_pending: boolean
  location_whitelist: string[] | null
  expires_at: string
  created_at: string
}

export type StampSlotState = 'dormant' | 'ready' | 'pressing' | 'stamped'

export interface StampPlacement {
  posX: number
  posY: number
  contactSizePx: number
  rotationDeg: number
}

export interface EmployeeAuthorization {
  id: string
  user_id: string
  institution_id: string
  can_verify: boolean
  can_distribute_prizes: boolean
  can_add_extras: boolean
  institution_name?: string
  institution_type?: string
  catalog_url?: string | null
}

export interface Accolade {
  id: string
  stamp_id: string
  stop_id: string
  user_id: string
  given_by: string
  giver_role: string
  giver_institution: string | null
  title: string
  note: string | null
  given_at: string
  nominated_for_rangers_choice: boolean
  rangers_choice_year: number | null
}

export interface ReadingRecommendation {
  id: string
  stamp_id: string
  user_id: string
  recommended_by: string
  recommender_role: string
  title: string
  author: string | null
  catalog_url: string | null
  note: string | null
  recommended_at: string
}
