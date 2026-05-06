-- PanoplyConnect schema additions.
-- Assumes Expo 001_initial_schema.sql and Designer 002_designer_schema.sql already ran.
-- The stamps and collector_passports tables already exist; we extend them.

-- ─────────────────────────────────────────────
-- EXTEND EXISTING TABLES
-- ─────────────────────────────────────────────

-- Add passport_id to existing stamps for direct passport linkage
ALTER TABLE public.stamps
  ADD COLUMN IF NOT EXISTS passport_id uuid REFERENCES public.passports(id);

-- Backfill passport_id via collector_passport if it exists
UPDATE public.stamps s
SET passport_id = cp.passport_id
FROM public.collector_passports cp
WHERE s.collector_passport_id = cp.id AND s.passport_id IS NULL;

-- Add profile fields used by Connect
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS traveler_type text
    CHECK (traveler_type IN ('wanderer','pilgrim','nester','hedonist','culturist','adventurer','challenger','savourer','local_explorer'));

-- Add missing passport fields
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS passport_type text DEFAULT 'location'
    CHECK (passport_type IN ('location','experience','learning')),
  ADD COLUMN IF NOT EXISTS transit_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_hours float,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS traveler_types text[],
  ADD COLUMN IF NOT EXISTS award_year integer,
  ADD COLUMN IF NOT EXISTS shortlisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proprietor_id uuid REFERENCES public.institutions(id);

-- ─────────────────────────────────────────────
-- ACQUISITIONS
-- Parallel to collector_passports; use this in Connect, collector_passports in Expo.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acquisitions (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id               uuid REFERENCES public.passports(id) NOT NULL,
  acquired_at               timestamptz DEFAULT now(),
  price_paid_cents          integer DEFAULT 0,
  stripe_payment_intent_id  text,
  UNIQUE(user_id, passport_id)
);

-- ─────────────────────────────────────────────
-- PRESENCE SESSIONS
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- JOURNAL ENTRIES
-- PRIVACY: Content is NEVER used in analytics.
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- MOOD RATINGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mood_ratings (
  id        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid REFERENCES public.profiles(id) NOT NULL,
  stamp_id  uuid REFERENCES public.stamps(id) NOT NULL,
  rating    integer CHECK (rating BETWEEN 1 AND 5),
  rated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, stamp_id)
);

-- ─────────────────────────────────────────────
-- COMPLETION TOKENS
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- JOURNEYS & SHARING
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- SHARE TOKENS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id uuid REFERENCES public.passports(id) NOT NULL,
  token       text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- INSTITUTIONAL
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- TIPS — 100% goes to creator, no Panoply cut
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tips (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id              uuid REFERENCES public.profiles(id) NOT NULL,
  passport_id               uuid REFERENCES public.passports(id) NOT NULL,
  creator_id                uuid REFERENCES public.profiles(id) NOT NULL,
  amount_cents              integer NOT NULL CHECK (amount_cents > 0),
  stripe_payment_intent_id  text,
  note                      text,
  tipped_at                 timestamptz DEFAULT now()
  -- 100% of tip (minus Stripe processing fee) transfers to creator.
  -- Panoply retains ZERO. Enforced in /api/tip route.
);

-- ─────────────────────────────────────────────
-- QUALITY SCORES (computed quarterly, cached)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_quality_scores (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passport_id         uuid REFERENCES public.passports(id) NOT NULL,
  computed_at         timestamptz DEFAULT now(),
  completion_rate     float,
  avg_mood_rating     float,
  return_visit_rate   float,
  expert_signoff_rate float,
  -- composite = completion×0.30 + (mood/5)×0.30 + return×0.20 + signoff×0.20
  composite_score     float,
  pool_share_cents    integer
);

-- ─────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE public.acquisitions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_ratings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journeys                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_sharing_terms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_tokens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_configurations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_authorizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_quality_scores    ENABLE ROW LEVEL SECURITY;

-- Acquisitions: own rows only
CREATE POLICY "acquisitions_own" ON public.acquisitions
  FOR ALL USING (user_id = auth.uid());

-- Presence sessions: own rows only
CREATE POLICY "presence_own" ON public.presence_sessions
  FOR ALL USING (user_id = auth.uid());

-- Journal entries: own rows, or shared via journal_sharing_terms
-- NEVER readable by analytics queries — enforced by never granting service_role journal content access
CREATE POLICY "journal_own" ON public.journal_entries
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "journal_shared_read" ON public.journal_entries
  FOR SELECT USING (
    is_shared = true AND EXISTS (
      SELECT 1 FROM public.journal_sharing_terms jst
      WHERE jst.from_user_id = journal_entries.user_id
        AND jst.to_user_id   = auth.uid()
        AND jst.visibility   = 'immediate'
    )
  );

-- Mood ratings: own rows
CREATE POLICY "mood_own" ON public.mood_ratings
  FOR ALL USING (user_id = auth.uid());

-- Completion tokens: own rows
CREATE POLICY "tokens_own" ON public.completion_tokens
  FOR SELECT USING (user_id = auth.uid());

-- Employees can read tokens for their institution's passports
CREATE POLICY "tokens_employee_read" ON public.completion_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      JOIN public.passports p ON p.id = completion_tokens.passport_id
      WHERE ea.user_id = auth.uid()
        AND ea.institution_id = p.proprietor_id
        AND ea.can_verify = true
    )
  );

-- Employees can update tokens (mark redeemed)
CREATE POLICY "tokens_employee_update" ON public.completion_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      JOIN public.passports p ON p.id = completion_tokens.passport_id
      WHERE ea.user_id = auth.uid()
        AND ea.institution_id = p.proprietor_id
        AND ea.can_distribute_prizes = true
    )
  );

-- Journeys: members can read
CREATE POLICY "journeys_member_read" ON public.journeys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journeys.id AND jm.user_id = auth.uid()
    )
  );

CREATE POLICY "journeys_owner_write" ON public.journeys
  FOR ALL USING (created_by = auth.uid());

-- Journey members: members see their journey
CREATE POLICY "journey_members_read" ON public.journey_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.journey_members jm
      WHERE jm.journey_id = journey_members.journey_id AND jm.user_id = auth.uid()
    )
  );

-- Journal sharing terms: own terms
CREATE POLICY "sharing_terms_own" ON public.journal_sharing_terms
  FOR ALL USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Share tokens: own
CREATE POLICY "share_tokens_own" ON public.share_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "share_tokens_public_read" ON public.share_tokens
  FOR SELECT USING (true);

-- Institution subscriptions: institution managers
CREATE POLICY "inst_sub_read" ON public.institution_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = institution_subscriptions.institution_id
        AND ea.user_id = auth.uid()
    )
  );

-- Prize configurations: institution managers read, employees read
CREATE POLICY "prize_config_inst_read" ON public.prize_configurations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = prize_configurations.institution_id
        AND ea.user_id = auth.uid()
    )
  );

CREATE POLICY "prize_config_inst_write" ON public.prize_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = prize_configurations.institution_id
        AND ea.user_id = auth.uid()
        AND ea.can_distribute_prizes = true
    )
  );

-- Employee authorizations: managers read/write their institution
CREATE POLICY "emp_auth_read" ON public.employee_authorizations
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
      WHERE ea.institution_id = employee_authorizations.institution_id
        AND ea.user_id = auth.uid()
    )
  );

CREATE POLICY "emp_auth_write" ON public.employee_authorizations
  FOR ALL USING (authorized_by = auth.uid());

-- Tips: own tip history
CREATE POLICY "tips_own" ON public.tips
  FOR ALL USING (from_user_id = auth.uid() OR creator_id = auth.uid());

-- Quality scores: public read (drives store sort)
CREATE POLICY "quality_scores_public_read" ON public.creator_quality_scores
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS acquisitions_user_idx        ON public.acquisitions(user_id);
CREATE INDEX IF NOT EXISTS acquisitions_passport_idx    ON public.acquisitions(passport_id);
CREATE INDEX IF NOT EXISTS presence_user_stop_idx       ON public.presence_sessions(user_id, stop_id);
CREATE INDEX IF NOT EXISTS journal_stamp_idx            ON public.journal_entries(stamp_id);
CREATE INDEX IF NOT EXISTS completion_tokens_code_idx   ON public.completion_tokens(token_code);
CREATE INDEX IF NOT EXISTS quality_scores_passport_idx  ON public.creator_quality_scores(passport_id);
CREATE INDEX IF NOT EXISTS quality_scores_composite_idx ON public.creator_quality_scores(composite_score DESC);
