-- 000_baseline.sql
-- Okuji complete database baseline — generated 2026-05-06
-- Represents the full schema as of Blockpoint 3 (migrations 001–011).
-- Run this file ONLY when setting up a fresh database.
-- Do NOT run on an existing database that already has these tables.

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables (dependency order) ─────────────────────────────────────────────────

-- profiles — one row per auth user, auto-created by handle_new_user trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id                        uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name              text,
  avatar_url                text,
  role                      text    NOT NULL DEFAULT 'collector'
    CHECK (role IN ('collector', 'creator', 'employee', 'admin')),
  bio                       text,
  website_url               text,
  stripe_connect_account_id text,
  date_of_birth             date,
  traveler_type             text
    CHECK (traveler_type IN (
      'wanderer', 'pilgrim', 'nester', 'hedonist',
      'culturist', 'adventurer', 'challenger', 'savourer', 'local_explorer'
    )),
  pro_expires_at            timestamptz,
  auth_provider             text    NOT NULL DEFAULT 'email',
  connect_roles             text[]  NOT NULL DEFAULT '{}',
  is_platform_admin         boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- institutions — schools, libraries, commercial venues, etc.
CREATE TABLE IF NOT EXISTS public.institutions (
  id               uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text  NOT NULL,
  slug             text  UNIQUE,
  logo_url         text,
  tier             text  NOT NULL DEFAULT 'community'
    CHECK (tier IN ('community', 'commercial', 'enterprise')),
  institution_type text  DEFAULT 'general'
    CHECK (institution_type IN (
      'k12_school', 'public_library', 'museum', 'educational_nonprofit',
      'after_school_program', 'literacy_organization', 'youth_development',
      'homeschool_cooperative',
      'parks_department', 'nature_conservatory', 'land_trust',
      'watershed_council', 'native_plant_society', 'wildlife_rehabilitation',
      'environmental_education',
      'historical_society', 'heritage_organization', 'cultural_center',
      'oral_history_project',
      'community_theater', 'public_art_organization', 'community_arts_center',
      'community_music_program', 'writing_center',
      'food_bank', 'homeless_shelter', 'refugee_immigrant_services',
      'free_health_clinic', 'adult_literacy',
      'community_garden', 'maker_space', 'tool_lending_library', 'seed_library',
      'municipality',
      'zoo', 'aquarium', 'botanical_garden', 'science_museum',
      'childrens_museum', 'nature_center_paid',
      'chamber_of_commerce', 'tourism_board', 'proprietor', 'hotel_chain', 'expo_organizer',
      'general', 'library', 'school', 'park', 'historic_site', 'nonprofit', 'other'
    )),
  catalog_url      text,
  charges_admission boolean   NOT NULL DEFAULT false,
  pricing_model    text       NOT NULL DEFAULT 'free'
    CHECK (pricing_model IN ('free', 'paid_passport', 'community', 'regional', 'enterprise')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- passports — top-level passport record
CREATE TABLE IF NOT EXISTS public.passports (
  id                         uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id                 uuid  REFERENCES public.profiles(id) NOT NULL,
  proprietor_id              uuid  REFERENCES public.institutions(id),
  title                      text  NOT NULL DEFAULT 'Untitled Passport',
  description                text,
  passport_type              text  NOT NULL DEFAULT 'location'
    CHECK (passport_type IN ('location', 'experience', 'learning')),
  cover_bg_color             text,
  cover_emblem               text,
  cover_image_url            text,
  cover_outside_data         jsonb DEFAULT '{}',
  cover_inside_data          jsonb DEFAULT '{}',
  cover_thumbnail            text,
  cover_template             text  NOT NULL DEFAULT 'classic',
  cover_paper_color          text  NOT NULL DEFAULT 'F5F2EC',
  is_published               boolean NOT NULL DEFAULT false,
  is_free                    boolean NOT NULL DEFAULT true,
  price_cents                integer,
  expected_spend_tier        text,
  expected_spend_note        text,
  transit_accessible         boolean NOT NULL DEFAULT false,
  wheelchair_accessible      boolean NOT NULL DEFAULT false,
  estimated_hours            float,
  traveler_types             text[],
  award_year                 integer,
  shortlisted                boolean NOT NULL DEFAULT false,
  status                     text    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  print_enabled              boolean NOT NULL DEFAULT false,
  print_journal_setting      text    NOT NULL DEFAULT 'include_all'
    CHECK (print_journal_setting IN ('include_all', 'exclude_all', 'per_stop')),
  design_state               jsonb,
  design_state_updated_at    timestamptz,
  published_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passports ENABLE ROW LEVEL SECURITY;

-- passport_pages — one or more pages per passport
CREATE TABLE IF NOT EXISTS public.passport_pages (
  id                       uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id              uuid  REFERENCES public.passports(id) ON DELETE CASCADE NOT NULL,
  page_number              integer,
  page_order               integer NOT NULL DEFAULT 0,
  page_type                text    NOT NULL DEFAULT 'stamp'
    CHECK (page_type IN ('stamp', 'information')),
  section_name             text,
  section_title            text,
  section_subtitle         text,
  prize_description        text,
  prize_location_constraint text,
  background_type          text    NOT NULL DEFAULT 'guilloche'
    CHECK (background_type IN ('guilloche', 'landscape', 'none', 'custom')),
  background_color         text    NOT NULL DEFAULT '0D1B2A',
  background_opacity       integer NOT NULL DEFAULT 12,
  paper_color              text    NOT NULL DEFAULT 'F5F2EC',
  elements                 jsonb   NOT NULL DEFAULT '[]',
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passport_pages ENABLE ROW LEVEL SECURITY;

-- design_assets — custom stamps, backgrounds, covers uploaded by users
CREATE TABLE IF NOT EXISTS public.design_assets (
  id             uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id       uuid         REFERENCES public.profiles(id) NOT NULL,
  institution_id uuid         REFERENCES public.institutions(id),
  name           text,
  asset_type     text         NOT NULL
    CHECK (asset_type IN ('background', 'stamp', 'cover')),
  url            text,
  storage_path   text,
  file_format    text,
  thumbnail_data text,
  is_built_in    boolean      NOT NULL DEFAULT false,
  is_monochrome  boolean,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;

-- stops — individual locations/experiences on a passport page
CREATE TABLE IF NOT EXISTS public.stops (
  id                            uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id                       uuid  REFERENCES public.passport_pages(id) ON DELETE CASCADE NOT NULL,
  stop_order                    integer NOT NULL DEFAULT 0,
  stop_number                   integer,
  name                          text    NOT NULL DEFAULT 'New Stop',
  address_street                text,
  address_city                  text,
  address_state                 text,
  address_zip                   text,
  lat                           float,
  lng                           float,
  geohash                       text,
  verification_tier             integer NOT NULL DEFAULT 1,
  verification_radius_meters    integer NOT NULL DEFAULT 100,
  qr_code_token                 text,
  stamp_icon                    text    NOT NULL DEFAULT '📍',
  stamp_color                   text    NOT NULL DEFAULT '1D9E75',
  stamp_asset_id                uuid    REFERENCES public.design_assets(id),
  stamp_type                    text    NOT NULL DEFAULT 'emoji'
    CHECK (stamp_type IN ('emoji', 'custom_asset')),
  stamp_rotation_fixed          integer,
  stamp_rotation_min            integer NOT NULL DEFAULT -15,
  stamp_rotation_max            integer NOT NULL DEFAULT 15,
  smudge_intensity              text    NOT NULL DEFAULT 'none'
    CHECK (smudge_intensity IN ('none', 'light', 'medium', 'heavy')),
  box_x                         float,
  box_y                         float,
  box_width                     float   NOT NULL DEFAULT 120,
  box_height                    float   NOT NULL DEFAULT 120,
  learning_objective            text,
  experience_type               text    CHECK (experience_type IN ('location', 'experience')),
  experience_verification_method text   CHECK (experience_verification_method IN ('witnessed', 'documented', 'presence', 'honor')),
  classifiers                   text[]  NOT NULL DEFAULT '{}',
  grade_levels                  text[]  NOT NULL DEFAULT '{}',
  subject_areas                 text[]  NOT NULL DEFAULT '{}',
  journal_prompt                text,
  print_include_journal         boolean NOT NULL DEFAULT true,
  is_shared                     boolean NOT NULL DEFAULT false,
  shared_at                     timestamptz,
  original_stop_id              uuid    REFERENCES public.stops(id),
  attribution_note              text,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;

-- stamps — a collector's earned stamp at a stop
CREATE TABLE IF NOT EXISTS public.stamps (
  id                 uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid  REFERENCES public.profiles(id) NOT NULL,
  stop_id            uuid  REFERENCES public.stops(id) NOT NULL,
  passport_id        uuid  REFERENCES public.passports(id),
  verified_at        timestamptz,
  verification_method text,
  geohash            text,
  stamp_pos_x        float,
  stamp_pos_y        float,
  contact_size_px    float,
  rotation_deg       float,
  verifier_id        uuid  REFERENCES public.profiles(id),
  verifier_note      text
);

ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;

-- acquisitions — records that a user has acquired a passport
CREATE TABLE IF NOT EXISTS public.acquisitions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id               uuid REFERENCES public.passports(id) NOT NULL,
  acquired_at               timestamptz DEFAULT now(),
  price_paid_cents          integer DEFAULT 0,
  stripe_payment_intent_id  text,
  UNIQUE(user_id, passport_id)
);

ALTER TABLE public.acquisitions ENABLE ROW LEVEL SECURITY;

-- presence_sessions — foot traffic data per stop
CREATE TABLE IF NOT EXISTS public.presence_sessions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES public.profiles(id) NOT NULL,
  stop_id          uuid REFERENCES public.stops(id) NOT NULL,
  arrived_at       timestamptz NOT NULL,
  departed_at      timestamptz,
  duration_seconds integer,
  session_number   integer DEFAULT 1,
  local_timezone   text NOT NULL
);

ALTER TABLE public.presence_sessions ENABLE ROW LEVEL SECURITY;

-- journal_entries — private collector reflections (NEVER used in analytics)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES public.profiles(id) NOT NULL,
  stamp_id       uuid REFERENCES public.stamps(id),
  stop_id        uuid REFERENCES public.stops(id),
  passport_id    uuid REFERENCES public.passports(id),
  entry_type     text DEFAULT 'voice'
    CHECK (entry_type IN ('voice', 'text', 'photo', 'video')),
  content        text,
  media_url      text,
  entry_number   integer DEFAULT 1,
  context_label  text,
  recorded_at    timestamptz DEFAULT now(),
  is_shared      boolean DEFAULT false
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- mood_ratings — 1–5 rating left by collector after a stop
CREATE TABLE IF NOT EXISTS public.mood_ratings (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES public.profiles(id) NOT NULL,
  stamp_id  uuid REFERENCES public.stamps(id) NOT NULL,
  rating    integer CHECK (rating BETWEEN 1 AND 5),
  rated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, stamp_id)
);

ALTER TABLE public.mood_ratings ENABLE ROW LEVEL SECURITY;

-- completion_tokens — generated when a collector completes a passport page
CREATE TABLE IF NOT EXISTS public.completion_tokens (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id             uuid REFERENCES public.passports(id) NOT NULL,
  page_id                 uuid REFERENCES public.passport_pages(id) NOT NULL,
  token_code              text UNIQUE NOT NULL,
  generated_at            timestamptz DEFAULT now(),
  redeemed_at             timestamptz,
  redeemed_by             uuid REFERENCES public.profiles(id),
  prize_distributed       boolean DEFAULT false,
  distribution_pending    boolean DEFAULT false,
  distribution_logged_at  timestamptz,
  distribution_logged_by  uuid REFERENCES public.profiles(id),
  prize_note              text
);

ALTER TABLE public.completion_tokens ENABLE ROW LEVEL SECURITY;

-- journeys — group passport experiences
CREATE TABLE IF NOT EXISTS public.journeys (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  passport_id uuid REFERENCES public.passports(id) NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

-- journey_members — who belongs to a journey
CREATE TABLE IF NOT EXISTS public.journey_members (
  journey_id  uuid REFERENCES public.journeys(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  joined_at   timestamptz DEFAULT now(),
  role        text DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  PRIMARY KEY (journey_id, user_id)
);

ALTER TABLE public.journey_members ENABLE ROW LEVEL SECURITY;

-- journal_sharing_terms — consent agreements for shared journeys
CREATE TABLE IF NOT EXISTS public.journal_sharing_terms (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id    uuid REFERENCES public.journeys(id) NOT NULL,
  from_user_id  uuid REFERENCES public.profiles(id) NOT NULL,
  to_user_id    uuid REFERENCES public.profiles(id) NOT NULL,
  visibility    text DEFAULT 'private'
    CHECK (visibility IN ('immediate', 'reveal_date', 'private')),
  reveal_date   date,
  agreed_at     timestamptz,
  UNIQUE(journey_id, from_user_id, to_user_id)
);

ALTER TABLE public.journal_sharing_terms ENABLE ROW LEVEL SECURITY;

-- share_tokens — one-time share links for passports
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id uuid REFERENCES public.passports(id) NOT NULL,
  token       text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

-- institution_subscriptions — billing tier for each institution
CREATE TABLE IF NOT EXISTS public.institution_subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id          uuid REFERENCES public.institutions(id) NOT NULL UNIQUE,
  tier                    text DEFAULT 'free'
    CHECK (tier IN ('free', 'community', 'regional', 'enterprise')),
  monthly_price_cents     integer DEFAULT 0,
  stripe_subscription_id  text,
  started_at              timestamptz DEFAULT now(),
  current_period_end      timestamptz
);

ALTER TABLE public.institution_subscriptions ENABLE ROW LEVEL SECURITY;

-- prize_configurations — what prize an institution offers for completing a page
CREATE TABLE IF NOT EXISTS public.prize_configurations (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id            uuid REFERENCES public.passport_pages(id) NOT NULL UNIQUE,
  institution_id     uuid REFERENCES public.institutions(id) NOT NULL,
  prize_description  text NOT NULL,
  prize_value_cents  integer,
  location_whitelist uuid[],
  configured_by      uuid REFERENCES public.profiles(id) NOT NULL,
  configured_at      timestamptz DEFAULT now()
);

ALTER TABLE public.prize_configurations ENABLE ROW LEVEL SECURITY;

-- employee_authorizations — who can verify stamps / distribute prizes at an institution
CREATE TABLE IF NOT EXISTS public.employee_authorizations (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id         uuid REFERENCES public.institutions(id) NOT NULL,
  user_id                uuid REFERENCES public.profiles(id) NOT NULL,
  role_label             text,
  can_verify             boolean DEFAULT true,
  can_distribute_prizes  boolean DEFAULT true,
  can_add_extras         boolean DEFAULT false,
  authorized_by          uuid REFERENCES public.profiles(id),
  authorized_at          timestamptz DEFAULT now(),
  UNIQUE(institution_id, user_id)
);

ALTER TABLE public.employee_authorizations ENABLE ROW LEVEL SECURITY;

-- tips — 100% goes to creator; Okuji retains zero
CREATE TABLE IF NOT EXISTS public.tips (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id              uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id               uuid REFERENCES public.passports(id) NOT NULL,
  creator_id                uuid REFERENCES public.profiles(id) NOT NULL,
  amount_cents              integer NOT NULL CHECK (amount_cents > 0),
  stripe_payment_intent_id  text,
  note                      text,
  tipped_at                 timestamptz DEFAULT now()
);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- creator_quality_scores — computed quarterly, drives Explore sort order
CREATE TABLE IF NOT EXISTS public.creator_quality_scores (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id         uuid REFERENCES public.passports(id) NOT NULL,
  computed_at         timestamptz DEFAULT now(),
  completion_rate     float,
  avg_mood_rating     float,
  return_visit_rate   float,
  expert_signoff_rate float,
  composite_score     float,
  pool_share_cents    integer
);

ALTER TABLE public.creator_quality_scores ENABLE ROW LEVEL SECURITY;

-- print_jobs — audit log for physical passport print requests
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id     uuid        REFERENCES public.passports(id) NOT NULL,
  institution_id  uuid        NOT NULL,
  created_by      uuid        REFERENCES public.profiles(id) NOT NULL,
  stop_ids        uuid[]      NOT NULL,
  copies          integer     NOT NULL CHECK (copies > 0),
  journal_setting text        NOT NULL
    CHECK (journal_setting IN ('per_stop', 'include_all', 'exclude_all')),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- passport_autosaves — rolling 10-save autosave buffer per passport
CREATE TABLE IF NOT EXISTS public.passport_autosaves (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id  uuid        REFERENCES public.passports(id) ON DELETE CASCADE NOT NULL,
  design_state jsonb       NOT NULL,
  saved_at     timestamptz DEFAULT now()
);

ALTER TABLE public.passport_autosaves ENABLE ROW LEVEL SECURITY;

-- ── Admin helper function ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ── RLS policies (all tables) ─────────────────────────────────────────────────

-- profiles
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

-- institutions
CREATE POLICY "institutions_public_read" ON public.institutions
  FOR SELECT USING (true);
CREATE POLICY "institutions_manager_write" ON public.institutions
  FOR ALL USING (id = auth.uid() OR public.is_admin() = true);

-- passports
CREATE POLICY "passports_creator" ON public.passports
  FOR ALL USING (creator_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "passports_public_read" ON public.passports
  FOR SELECT USING (is_published = true OR creator_id = auth.uid() OR public.is_admin() = true);

-- passport_pages
CREATE POLICY "pages_creator" ON public.passport_pages
  FOR ALL USING (
    passport_id IN (SELECT id FROM public.passports WHERE creator_id = auth.uid())
    OR public.is_admin() = true
  );
CREATE POLICY "pages_public_read" ON public.passport_pages
  FOR SELECT USING (
    passport_id IN (SELECT id FROM public.passports WHERE is_published = true)
    OR passport_id IN (SELECT id FROM public.passports WHERE creator_id = auth.uid())
    OR public.is_admin() = true
  );

-- design_assets
CREATE POLICY "design_assets_owner" ON public.design_assets
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "design_assets_institution_read" ON public.design_assets
  FOR SELECT USING (
    public.is_admin() = true
    OR owner_id = auth.uid()
    OR is_built_in = true
    OR (
      institution_id IS NOT NULL AND institution_id IN (
        SELECT institution_id FROM public.employee_authorizations WHERE user_id = auth.uid()
      )
    )
  );

-- stops
CREATE POLICY "stops_creator" ON public.stops
  FOR ALL USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.creator_id = auth.uid()
    )
    OR public.is_admin() = true
  );
CREATE POLICY "stops_public_read" ON public.stops
  FOR SELECT USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.is_published = true
    )
    OR public.is_admin() = true
  );
CREATE POLICY "stops_shared_read" ON public.stops
  FOR SELECT USING (is_shared = true OR public.is_admin() = true);

-- stamps
CREATE POLICY "stamps_own" ON public.stamps
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "stamps_employee_read" ON public.stamps
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      JOIN public.passports p ON p.id = stamps.passport_id
      WHERE ea.user_id = auth.uid()
        AND ea.institution_id = p.proprietor_id
        AND ea.can_verify = true
    )
  );

-- acquisitions
CREATE POLICY "acquisitions_own" ON public.acquisitions
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- presence_sessions
CREATE POLICY "presence_own" ON public.presence_sessions
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- journal_entries
CREATE POLICY "journal_own" ON public.journal_entries
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "journal_shared_read" ON public.journal_entries
  FOR SELECT USING (
    public.is_admin() = true
    OR (
      is_shared = true AND EXISTS (
        SELECT 1 FROM public.journal_sharing_terms jst
        WHERE jst.from_user_id = journal_entries.user_id
          AND jst.to_user_id   = auth.uid()
          AND jst.visibility   = 'immediate'
      )
    )
  );

-- mood_ratings
CREATE POLICY "mood_own" ON public.mood_ratings
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- completion_tokens
CREATE POLICY "tokens_own" ON public.completion_tokens
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "tokens_employee_read" ON public.completion_tokens
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      JOIN public.passports p ON p.id = completion_tokens.passport_id
      WHERE ea.user_id = auth.uid()
        AND ea.institution_id = p.proprietor_id
        AND ea.can_verify = true
    )
  );
CREATE POLICY "tokens_employee_update" ON public.completion_tokens
  FOR UPDATE USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      JOIN public.passports p ON p.id = completion_tokens.passport_id
      WHERE ea.user_id = auth.uid()
        AND ea.institution_id = p.proprietor_id
        AND ea.can_distribute_prizes = true
    )
  );

-- journeys
CREATE POLICY "journeys_member_read" ON public.journeys
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journeys.id AND jm.user_id = auth.uid()
    )
  );
CREATE POLICY "journeys_owner_write" ON public.journeys
  FOR ALL USING (created_by = auth.uid() OR public.is_admin() = true);

-- journey_members
CREATE POLICY "journey_members_read" ON public.journey_members
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journey_members.journey_id AND jm.user_id = auth.uid()
    )
  );

-- journal_sharing_terms
CREATE POLICY "sharing_terms_own" ON public.journal_sharing_terms
  FOR ALL USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin() = true
  );

-- share_tokens
CREATE POLICY "share_tokens_own" ON public.share_tokens
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);
CREATE POLICY "share_tokens_public_read" ON public.share_tokens
  FOR SELECT USING (true);

-- institution_subscriptions
CREATE POLICY "inst_sub_read" ON public.institution_subscriptions
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = institution_subscriptions.institution_id
        AND ea.user_id = auth.uid()
    )
  );

-- prize_configurations
CREATE POLICY "prize_config_inst_read" ON public.prize_configurations
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = prize_configurations.institution_id
        AND ea.user_id = auth.uid()
    )
  );
CREATE POLICY "prize_config_inst_write" ON public.prize_configurations
  FOR ALL USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = prize_configurations.institution_id
        AND ea.user_id = auth.uid()
        AND ea.can_distribute_prizes = true
    )
  );

-- employee_authorizations
CREATE POLICY "emp_auth_read" ON public.employee_authorizations
  FOR SELECT USING (
    public.is_admin() = true
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = employee_authorizations.institution_id
        AND ea.user_id = auth.uid()
    )
  );
CREATE POLICY "emp_auth_write" ON public.employee_authorizations
  FOR ALL USING (authorized_by = auth.uid() OR public.is_admin() = true);

-- tips
CREATE POLICY "tips_own" ON public.tips
  FOR ALL USING (
    from_user_id = auth.uid() OR creator_id = auth.uid() OR public.is_admin() = true
  );

-- creator_quality_scores
CREATE POLICY "quality_scores_public_read" ON public.creator_quality_scores
  FOR SELECT USING (true);

-- print_jobs
CREATE POLICY "print_jobs_own" ON public.print_jobs
  FOR ALL USING (created_by = auth.uid() OR public.is_admin() = true);

-- passport_autosaves
CREATE POLICY "autosaves_own" ON public.passport_autosaves
  FOR ALL USING (
    public.is_admin() = true
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = auth.uid()
    )
  );

-- ── Triggers and functions ────────────────────────────────────────────────────

-- handle_new_user — creates a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, auth_provider)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN NEW.app_metadata->>'provider' = 'google' THEN 'google'
      ELSE 'email'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url    = EXCLUDED.avatar_url,
    auth_provider = EXCLUDED.auth_provider;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- trim_passport_autosaves — keeps only the 10 most recent autosaves per passport
CREATE OR REPLACE FUNCTION public.trim_passport_autosaves()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.passport_autosaves
  WHERE passport_id = NEW.passport_id
    AND id NOT IN (
      SELECT id FROM public.passport_autosaves
      WHERE passport_id = NEW.passport_id
      ORDER BY saved_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trim_autosaves_trigger ON public.passport_autosaves;
CREATE TRIGGER trim_autosaves_trigger
  AFTER INSERT ON public.passport_autosaves
  FOR EACH ROW EXECUTE FUNCTION public.trim_passport_autosaves();

-- ── Storage buckets ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('design-assets', 'design-assets', true),
  ('avatars',       'avatars',       true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "design_assets_upload" ON storage.objects;
CREATE POLICY "design_assets_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'design-assets');

DROP POLICY IF EXISTS "design_assets_read" ON storage.objects;
CREATE POLICY "design_assets_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'design-assets');

DROP POLICY IF EXISTS "design_assets_delete" ON storage.objects;
CREATE POLICY "design_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'design-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
CREATE POLICY "avatars_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS passports_creator_idx            ON public.passports(creator_id);
CREATE INDEX IF NOT EXISTS passports_published_idx          ON public.passports(is_published);
CREATE INDEX IF NOT EXISTS pages_passport_idx               ON public.passport_pages(passport_id);
CREATE INDEX IF NOT EXISTS stops_page_idx                   ON public.stops(page_id);
CREATE INDEX IF NOT EXISTS stops_is_shared_idx              ON public.stops(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS stops_classifiers_idx            ON public.stops USING GIN(classifiers);
CREATE INDEX IF NOT EXISTS stops_grade_levels_idx           ON public.stops USING GIN(grade_levels);
CREATE INDEX IF NOT EXISTS stops_subject_areas_idx          ON public.stops USING GIN(subject_areas);
CREATE INDEX IF NOT EXISTS stops_original_stop_idx          ON public.stops(original_stop_id);
CREATE INDEX IF NOT EXISTS acquisitions_user_idx            ON public.acquisitions(user_id);
CREATE INDEX IF NOT EXISTS acquisitions_passport_idx        ON public.acquisitions(passport_id);
CREATE INDEX IF NOT EXISTS presence_user_stop_idx           ON public.presence_sessions(user_id, stop_id);
CREATE INDEX IF NOT EXISTS journal_stamp_idx                ON public.journal_entries(stamp_id);
CREATE INDEX IF NOT EXISTS completion_tokens_code_idx       ON public.completion_tokens(token_code);
CREATE INDEX IF NOT EXISTS quality_scores_passport_idx      ON public.creator_quality_scores(passport_id);
CREATE INDEX IF NOT EXISTS quality_scores_composite_idx     ON public.creator_quality_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS design_assets_owner_idx          ON public.design_assets(owner_id);
CREATE INDEX IF NOT EXISTS design_assets_institution_idx    ON public.design_assets(institution_id);
CREATE INDEX IF NOT EXISTS design_assets_type_idx           ON public.design_assets(asset_type);
CREATE INDEX IF NOT EXISTS design_assets_stamp_type_idx     ON public.design_assets(asset_type, owner_id) WHERE asset_type = 'stamp';
CREATE INDEX IF NOT EXISTS print_jobs_passport_idx          ON public.print_jobs(passport_id);
CREATE INDEX IF NOT EXISTS print_jobs_institution_idx       ON public.print_jobs(institution_id);
CREATE INDEX IF NOT EXISTS print_jobs_created_by_idx        ON public.print_jobs(created_by);
CREATE INDEX IF NOT EXISTS passport_autosaves_idx           ON public.passport_autosaves(passport_id, saved_at DESC);
