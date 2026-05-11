-- Migration 011: Blockpoint 3
-- Run after 001–010.

-- ─── stops: ensure is_shared / shared_at / classifiers columns exist ──────────
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS is_shared   boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at   timestamptz,
  ADD COLUMN IF NOT EXISTS classifiers text[]    DEFAULT '{}';

-- No check constraint on classifiers — validated at the application layer.

-- ─── passport_pages: information-page support ─────────────────────────────────
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS page_type text DEFAULT 'stamp'
    CHECK (page_type IN ('stamp', 'information'));

-- ─── institutions: pricing model support ─────────────────────────────────────
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS charges_admission boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'free'
    CHECK (pricing_model IN ('free', 'paid_passport', 'community', 'regional', 'enterprise'));

-- ─── institutions: expand type constraint ────────────────────────────────────
ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_type_check;

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_type_check
  CHECK (institution_type IN (
    -- Educational
    'k12_school', 'public_library', 'museum', 'educational_nonprofit',
    'after_school_program', 'literacy_organization', 'youth_development',
    'homeschool_cooperative',
    -- Environmental / conservation
    'parks_department', 'nature_conservatory', 'land_trust',
    'watershed_council', 'native_plant_society', 'wildlife_rehabilitation',
    'environmental_education',
    -- Cultural preservation
    'historical_society', 'heritage_organization', 'cultural_center',
    'oral_history_project',
    -- Community arts
    'community_theater', 'public_art_organization', 'community_arts_center',
    'community_music_program', 'writing_center',
    -- Social services
    'food_bank', 'homeless_shelter', 'refugee_immigrant_services',
    'free_health_clinic', 'adult_literacy',
    -- Community access
    'community_garden', 'maker_space', 'tool_lending_library', 'seed_library',
    -- Municipal
    'municipality',
    -- Admission-charging (paid passport model)
    'zoo', 'aquarium', 'botanical_garden', 'science_museum',
    'childrens_museum', 'nature_center_paid',
    -- Commercial
    'chamber_of_commerce', 'tourism_board', 'proprietor', 'hotel_chain',
    'expo_organizer',
    -- Legacy values kept for backwards compatibility
    'general', 'library', 'school', 'park', 'historic_site',
    'nonprofit', 'other'
  ));

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS stops_shared_educational
  ON public.stops (is_shared)
  WHERE is_shared = true;
