-- 015_pricing_model.sql
-- Adds pricing model fields to institutions table and expands type/model constraints.

-- New columns
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS municipality_population integer,
  ADD COLUMN IF NOT EXISTS pricing_model_locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_model_override_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_model_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_model_computed  text;

-- Expand pricing_model CHECK to include 'patron'
DO $$
BEGIN
  ALTER TABLE public.institutions
    DROP CONSTRAINT IF EXISTS institutions_pricing_model_check;
  ALTER TABLE public.institutions
    ADD CONSTRAINT institutions_pricing_model_check
      CHECK (pricing_model IN ('free','paid_passport','community','regional','enterprise','patron'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Expand institution_type CHECK to include all new canonical types
DO $$
BEGIN
  ALTER TABLE public.institutions
    DROP CONSTRAINT IF EXISTS institutions_institution_type_check;
  ALTER TABLE public.institutions
    ADD CONSTRAINT institutions_institution_type_check
      CHECK (institution_type IN (
        -- Educational
        'k12_school','public_library','museum','educational_nonprofit',
        'after_school_program','literacy_organization','youth_development','homeschool_cooperative',
        -- Cultural preservation
        'historical_society','heritage_organization','cultural_center','oral_history_project',
        -- Community arts
        'community_theater','public_art_organization','community_arts_center',
        'community_music_program','writing_center',
        -- Social services
        'food_bank','homeless_shelter','refugee_immigrant_services','free_health_clinic','adult_literacy',
        -- Environmental / conservation
        'parks_department','nature_conservatory','land_trust','watershed_council',
        'native_plant_society','wildlife_rehabilitation','environmental_education',
        -- Nature & science (admission determines pricing)
        'zoo','aquarium','botanical_garden','science_museum','childrens_museum','nature_center',
        -- Community access
        'community_garden','maker_space','tool_lending_library','seed_library',
        -- Municipal
        'municipality',
        -- Commercial — community tier
        'chamber_of_commerce','local_tourism_board','proprietor','hotel_group_small',
        -- Commercial — regional tier
        'state_tourism_board','convention_bureau',
        -- Commercial — enterprise tier
        'hotel_chain','airline','expo_organizer','national_tourism_org','theme_park','cruise_line',
        -- Patron
        'corporate_sponsor','foundation',
        -- Legacy / catch-all
        'nature_center_paid','tourism_board','general','library','school','park',
        'historic_site','nonprofit','other'
      ));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Recompute pricing_model_computed for all existing rows
-- (pricing_model_locked rows keep their current pricing_model)
UPDATE public.institutions
SET pricing_model_computed = pricing_model
WHERE pricing_model_computed IS NULL;
