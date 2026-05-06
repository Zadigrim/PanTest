-- Migration 012: Blockpoint 4 — admin flag, RLS bypass, stamp assets, monochrome
-- Run after 001–011.

-- ─── profiles: platform admin flag ───────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- NOTE: Set the founder's flag with:
--   UPDATE public.profiles SET is_platform_admin = true WHERE id = '<your-user-id>';

-- ─── RLS admin bypass: helper function ───────────────────────────────────────
-- Returns true when the current user is a platform admin.
-- Defined SECURITY DEFINER so it can read profiles without recursion issues.
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

-- ─── Guard: ensure all tables referenced in RLS policies below exist ─────────
-- Every CREATE TABLE and ALTER TABLE here uses IF NOT EXISTS / IF NOT EXISTS
-- so these are no-ops on databases where the earlier migrations already ran.

-- Columns added by 002_connect_schema to core tables
ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS passport_id    uuid REFERENCES public.passports(id);
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS proprietor_id  uuid REFERENCES public.institutions(id);

-- Column added by 004_classifiers_roles to stops
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS is_shared      boolean DEFAULT false;

-- ── Tables from 002_connect_schema ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acquisitions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id               uuid REFERENCES public.passports(id) NOT NULL,
  acquired_at               timestamptz DEFAULT now(),
  price_paid_cents          integer DEFAULT 0,
  stripe_payment_intent_id  text,
  UNIQUE(user_id, passport_id)
);

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

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES public.profiles(id) NOT NULL,
  stamp_id       uuid REFERENCES public.stamps(id) NOT NULL,
  stop_id        uuid REFERENCES public.stops(id) NOT NULL,
  passport_id    uuid REFERENCES public.passports(id) NOT NULL,
  entry_type     text DEFAULT 'voice'
    CHECK (entry_type IN ('voice','text','photo','video')),
  content        text,
  media_url      text,
  entry_number   integer DEFAULT 1,
  context_label  text,
  recorded_at    timestamptz DEFAULT now(),
  is_shared      boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.mood_ratings (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES public.profiles(id) NOT NULL,
  stamp_id  uuid REFERENCES public.stamps(id) NOT NULL,
  rating    integer CHECK (rating BETWEEN 1 AND 5),
  rated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, stamp_id)
);

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

CREATE TABLE IF NOT EXISTS public.journeys (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  passport_id uuid REFERENCES public.passports(id) NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journey_members (
  journey_id  uuid REFERENCES public.journeys(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  joined_at   timestamptz DEFAULT now(),
  role        text DEFAULT 'member'
    CHECK (role IN ('owner','member')),
  PRIMARY KEY (journey_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.journal_sharing_terms (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id    uuid REFERENCES public.journeys(id) NOT NULL,
  from_user_id  uuid REFERENCES public.profiles(id) NOT NULL,
  to_user_id    uuid REFERENCES public.profiles(id) NOT NULL,
  visibility    text DEFAULT 'private'
    CHECK (visibility IN ('immediate','reveal_date','private')),
  reveal_date   date,
  agreed_at     timestamptz,
  UNIQUE(journey_id, from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS public.institution_subscriptions (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id          uuid REFERENCES public.institutions(id) NOT NULL UNIQUE,
  tier                    text DEFAULT 'free'
    CHECK (tier IN ('free','community','regional','enterprise')),
  monthly_price_cents     integer DEFAULT 0,
  stripe_subscription_id  text,
  started_at              timestamptz DEFAULT now(),
  current_period_end      timestamptz
);

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

-- ── Tables from 005_print_for_kids ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id     uuid        REFERENCES public.passports(id) NOT NULL,
  institution_id  uuid        NOT NULL,
  created_by      uuid        REFERENCES public.profiles(id) NOT NULL,
  stop_ids        uuid[]      NOT NULL,
  copies          integer     NOT NULL CHECK (copies > 0),
  journal_setting text        NOT NULL
    CHECK (journal_setting IN ('per_stop','include_all','exclude_all')),
  created_at      timestamptz DEFAULT now()
);

-- ── Tables from 006_design_assets (with 012 columns pre-included) ────────────
CREATE TABLE IF NOT EXISTS public.design_assets (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        uuid        REFERENCES public.profiles(id) NOT NULL,
  institution_id  uuid        REFERENCES public.institutions(id),
  name            text,
  asset_type      text        NOT NULL
    CHECK (asset_type IN ('background','stamp','cover')),
  url             text,
  storage_path    text,
  created_at      timestamptz DEFAULT now(),
  is_built_in     boolean     NOT NULL DEFAULT false,
  file_format     text,
  thumbnail_data  text,
  is_monochrome   boolean
);
-- For databases where design_assets already existed without these columns:
ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS is_built_in    boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_format    text,
  ADD COLUMN IF NOT EXISTS thumbnail_data text,
  ADD COLUMN IF NOT EXISTS is_monochrome  boolean;

-- ── Tables from 009_blockpoint1 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passport_autosaves (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id  uuid        REFERENCES public.passports(id) ON DELETE CASCADE NOT NULL,
  design_state jsonb       NOT NULL,
  saved_at     timestamptz DEFAULT now()
);

-- Enable RLS on all potentially-new tables (idempotent)
ALTER TABLE public.acquisitions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_ratings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_sharing_terms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_configurations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_authorizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_quality_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_autosaves        ENABLE ROW LEVEL SECURITY;

-- ─── RLS policies: rebuild all with admin bypass ──────────────────────────────
-- Strategy: DROP each policy and recreate with  OR public.is_admin() = true

-- ── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

-- ── passports ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "passports_creator" ON public.passports;
CREATE POLICY "passports_creator" ON public.passports
  FOR ALL USING (creator_id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "passports_public_read" ON public.passports;
CREATE POLICY "passports_public_read" ON public.passports
  FOR SELECT USING (is_published = true OR creator_id = auth.uid() OR public.is_admin() = true);

-- ── passport_pages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pages_creator" ON public.passport_pages;
CREATE POLICY "pages_creator" ON public.passport_pages
  FOR ALL USING (
    passport_id IN (SELECT id FROM public.passports WHERE creator_id = auth.uid())
    OR public.is_admin() = true
  );

DROP POLICY IF EXISTS "pages_public_read" ON public.passport_pages;
CREATE POLICY "pages_public_read" ON public.passport_pages
  FOR SELECT USING (
    passport_id IN (SELECT id FROM public.passports WHERE is_published = true)
    OR passport_id IN (SELECT id FROM public.passports WHERE creator_id = auth.uid())
    OR public.is_admin() = true
  );

-- ── stops ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stops_creator" ON public.stops;
CREATE POLICY "stops_creator" ON public.stops
  FOR ALL USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.creator_id = auth.uid()
    )
    OR public.is_admin() = true
  );

DROP POLICY IF EXISTS "stops_public_read" ON public.stops;
CREATE POLICY "stops_public_read" ON public.stops
  FOR SELECT USING (
    page_id IN (
      SELECT pp.id FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE p.is_published = true
    )
    OR public.is_admin() = true
  );

DROP POLICY IF EXISTS "stops_shared_read" ON public.stops;
CREATE POLICY "stops_shared_read" ON public.stops
  FOR SELECT USING (is_shared = true OR public.is_admin() = true);

-- ── stamps ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stamps_own" ON public.stamps;
CREATE POLICY "stamps_own" ON public.stamps
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "stamps_employee_read" ON public.stamps;
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

-- ── presence_sessions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "presence_own" ON public.presence_sessions;
CREATE POLICY "presence_own" ON public.presence_sessions
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- ── journal_entries ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "journal_own" ON public.journal_entries;
CREATE POLICY "journal_own" ON public.journal_entries
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "journal_shared_read" ON public.journal_entries;
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

-- ── mood_ratings ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mood_own" ON public.mood_ratings;
CREATE POLICY "mood_own" ON public.mood_ratings
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- ── completion_tokens ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tokens_own" ON public.completion_tokens;
CREATE POLICY "tokens_own" ON public.completion_tokens
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "tokens_employee_read" ON public.completion_tokens;
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

DROP POLICY IF EXISTS "tokens_employee_update" ON public.completion_tokens;
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

-- ── journeys ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "journeys_member_read" ON public.journeys;
CREATE POLICY "journeys_member_read" ON public.journeys
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journeys.id AND jm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "journeys_owner_write" ON public.journeys;
CREATE POLICY "journeys_owner_write" ON public.journeys
  FOR ALL USING (created_by = auth.uid() OR public.is_admin() = true);

-- ── journey_members ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "journey_members_read" ON public.journey_members;
CREATE POLICY "journey_members_read" ON public.journey_members
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journey_members.journey_id AND jm.user_id = auth.uid()
    )
  );

-- ── journal_sharing_terms ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sharing_terms_own" ON public.journal_sharing_terms;
CREATE POLICY "sharing_terms_own" ON public.journal_sharing_terms
  FOR ALL USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_admin() = true
  );

-- ── institution_subscriptions ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "inst_sub_read" ON public.institution_subscriptions;
CREATE POLICY "inst_sub_read" ON public.institution_subscriptions
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = institution_subscriptions.institution_id
        AND ea.user_id = auth.uid()
    )
  );

-- ── prize_configurations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "prize_config_inst_read" ON public.prize_configurations;
CREATE POLICY "prize_config_inst_read" ON public.prize_configurations
  FOR SELECT USING (
    public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = prize_configurations.institution_id
        AND ea.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prize_config_inst_write" ON public.prize_configurations;
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

-- ── employee_authorizations ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "emp_auth_read" ON public.employee_authorizations;
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

DROP POLICY IF EXISTS "emp_auth_write" ON public.employee_authorizations;
CREATE POLICY "emp_auth_write" ON public.employee_authorizations
  FOR ALL USING (authorized_by = auth.uid() OR public.is_admin() = true);

-- ── tips ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tips_own" ON public.tips;
CREATE POLICY "tips_own" ON public.tips
  FOR ALL USING (
    from_user_id = auth.uid() OR creator_id = auth.uid() OR public.is_admin() = true
  );

-- ── creator_quality_scores ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "quality_scores_public_read" ON public.creator_quality_scores;
CREATE POLICY "quality_scores_public_read" ON public.creator_quality_scores
  FOR SELECT USING (true);

-- ── acquisitions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "acquisitions_own" ON public.acquisitions;
CREATE POLICY "acquisitions_own" ON public.acquisitions
  FOR ALL USING (user_id = auth.uid() OR public.is_admin() = true);

-- ── design_assets ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "design_assets_owner" ON public.design_assets;
CREATE POLICY "design_assets_owner" ON public.design_assets
  FOR ALL USING (owner_id = auth.uid() OR public.is_admin() = true);

DROP POLICY IF EXISTS "design_assets_institution_read" ON public.design_assets;
CREATE POLICY "design_assets_institution_read" ON public.design_assets
  FOR SELECT USING (
    public.is_admin() = true
    OR owner_id = auth.uid()
    OR is_built_in = true
    OR (
      institution_id IS NOT NULL AND institution_id IN (
        SELECT institution_id FROM public.employee_authorizations
        WHERE user_id = auth.uid()
      )
    )
  );

-- ── institutions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "institutions_public_read" ON public.institutions;
CREATE POLICY "institutions_public_read" ON public.institutions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "institutions_manager_write" ON public.institutions;
CREATE POLICY "institutions_manager_write" ON public.institutions
  FOR ALL USING (id = auth.uid() OR public.is_admin() = true);

-- ── passport_autosaves ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "autosaves_own" ON public.passport_autosaves;
CREATE POLICY "autosaves_own" ON public.passport_autosaves
  FOR ALL USING (
    public.is_admin() = true
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = auth.uid()
    )
  );

-- ── print_jobs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "print_jobs_own" ON public.print_jobs;
CREATE POLICY "print_jobs_own" ON public.print_jobs
  FOR ALL USING (created_by = auth.uid() OR public.is_admin() = true);

-- ─── stops: stamp asset reference ────────────────────────────────────────────
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS stamp_asset_id uuid REFERENCES public.design_assets(id),
  ADD COLUMN IF NOT EXISTS stamp_type text NOT NULL DEFAULT 'emoji'
    CHECK (stamp_type IN ('emoji', 'custom_asset'));

-- ─── Index for stamp asset lookups ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS design_assets_stamp_type_idx
  ON public.design_assets (asset_type, owner_id)
  WHERE asset_type = 'stamp';
