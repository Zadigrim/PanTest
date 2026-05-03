-- ─────────────────────────────────────────────
-- INSTITUTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.institutions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  type          text NOT NULL CHECK (type IN ('school','library','tourism_board','proprietor','other')),
  logo_url      text,
  admin_user_id uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institutions_read" ON public.institutions FOR SELECT USING (true);
CREATE POLICY "institutions_admin_manage" ON public.institutions
  FOR ALL USING (admin_user_id = auth.uid());

-- ─────────────────────────────────────────────
-- EXTEND PASSPORTS for designer fields
-- ─────────────────────────────────────────────
ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS institution_id         uuid REFERENCES public.institutions(id),
  ADD COLUMN IF NOT EXISTS cover_template         text DEFAULT 'guilloche_blue',
  ADD COLUMN IF NOT EXISTS cover_paper_color      text DEFAULT 'F5F2EC',
  ADD COLUMN IF NOT EXISTS status                 text DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  ADD COLUMN IF NOT EXISTS expected_spend_tier    text
    CHECK (expected_spend_tier IN ('free','under_15','15_50','50_150','150_500','500_plus')),
  ADD COLUMN IF NOT EXISTS expected_spend_note    text,
  ADD COLUMN IF NOT EXISTS transit_accessible     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at           timestamptz;

-- ─────────────────────────────────────────────
-- EXTEND PASSPORT_PAGES for designer fields
-- ─────────────────────────────────────────────
ALTER TABLE public.passport_pages
  ADD COLUMN IF NOT EXISTS page_number            integer,
  ADD COLUMN IF NOT EXISTS section_title          text,
  ADD COLUMN IF NOT EXISTS section_subtitle       text,
  ADD COLUMN IF NOT EXISTS prize_location_constraint text,
  ADD COLUMN IF NOT EXISTS background_type        text DEFAULT 'guilloche'
    CHECK (background_type IN ('guilloche','landscape','none','custom')),
  ADD COLUMN IF NOT EXISTS background_color       text DEFAULT '4a6fa5',
  ADD COLUMN IF NOT EXISTS background_opacity     integer DEFAULT 11
    CHECK (background_opacity BETWEEN 8 AND 20),
  ADD COLUMN IF NOT EXISTS paper_color            text DEFAULT 'F5F2EC';

-- ─────────────────────────────────────────────
-- EXTEND STOPS for designer fields
-- ─────────────────────────────────────────────
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS address                text,
  ADD COLUMN IF NOT EXISTS lat                    double precision,
  ADD COLUMN IF NOT EXISTS lng                    double precision,
  ADD COLUMN IF NOT EXISTS geohash                text,
  ADD COLUMN IF NOT EXISTS verification_tier      integer DEFAULT 2
    CHECK (verification_tier BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS verification_radius_meters integer DEFAULT 150,
  ADD COLUMN IF NOT EXISTS qr_code_token          text UNIQUE,
  ADD COLUMN IF NOT EXISTS stamp_rotation_min     integer DEFAULT -5,
  ADD COLUMN IF NOT EXISTS stamp_rotation_max     integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS smudge_intensity       text DEFAULT 'light'
    CHECK (smudge_intensity IN ('none','light','medium','heavy')),
  ADD COLUMN IF NOT EXISTS box_x                  double precision,
  ADD COLUMN IF NOT EXISTS box_y                  double precision,
  ADD COLUMN IF NOT EXISTS box_width              double precision DEFAULT 0.45,
  ADD COLUMN IF NOT EXISTS box_height             double precision DEFAULT 0.18,
  ADD COLUMN IF NOT EXISTS learning_objective     text,
  ADD COLUMN IF NOT EXISTS experience_type        text
    CHECK (experience_type IN ('location','experience')),
  ADD COLUMN IF NOT EXISTS experience_verification_method text
    CHECK (experience_verification_method IN ('witnessed','documented','presence','honor'));

-- ─────────────────────────────────────────────
-- SPEND VERIFICATION LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spend_verification_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_id             uuid REFERENCES public.passports(id) ON DELETE CASCADE NOT NULL,
  requested_tier          text NOT NULL,
  ai_suggested_range_low  integer,
  ai_suggested_range_high integer,
  ai_reasoning            text,
  creator_decision        text CHECK (creator_decision IN ('accepted','adjusted','overridden')),
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spend_verification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spend_log_own" ON public.spend_verification_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id AND p.creator_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- CREATOR CERTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creator_certifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  module               text NOT NULL
    CHECK (module IN ('backgrounds','typography','stamps','architecture','covers')),
  completed_at         timestamptz,
  portfolio_page_id    uuid REFERENCES public.passport_pages(id),
  UNIQUE(user_id, module)
);

ALTER TABLE public.creator_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifications_own" ON public.creator_certifications
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "certifications_read_public" ON public.creator_certifications
  FOR SELECT USING (completed_at IS NOT NULL);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS passports_institution_idx ON public.passports(institution_id);
CREATE INDEX IF NOT EXISTS passports_status_idx      ON public.passports(status);
CREATE INDEX IF NOT EXISTS stops_qr_token_idx        ON public.stops(qr_code_token);
CREATE INDEX IF NOT EXISTS certifications_user_idx   ON public.creator_certifications(user_id);
