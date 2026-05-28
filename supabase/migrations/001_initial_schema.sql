-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text NOT NULL,
  avatar_url      text,
  family_id       uuid,
  role            text NOT NULL DEFAULT 'collector'
                  CHECK (role IN ('collector','creator','employee','admin')),
  pro_expires_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- PROPRIETORS (McMenamins, chambers, etc.)
-- ─────────────────────────────────────────────
CREATE TABLE public.proprietors (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  logo_url        text,
  tier            text NOT NULL DEFAULT 'community'
                  CHECK (tier IN ('community','commercial','enterprise')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- EMPLOYEE ACCOUNTS (linked to proprietors)
-- ─────────────────────────────────────────────
CREATE TABLE public.employee_accounts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  proprietor_id   uuid NOT NULL REFERENCES public.proprietors(id),
  employee_name   text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- PASSPORTS
-- ─────────────────────────────────────────────
CREATE TABLE public.passports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id      uuid NOT NULL REFERENCES public.profiles(id),
  proprietor_id   uuid REFERENCES public.proprietors(id),
  title           text NOT NULL,
  description     text,
  passport_type   text NOT NULL DEFAULT 'location'
                  CHECK (passport_type IN ('location','experience','learning')),
  cover_bg_color  text NOT NULL DEFAULT '#0D1B2A',
  cover_bg_type   text NOT NULL DEFAULT 'gradient'
                  CHECK (cover_bg_type IN ('color','gradient','image')),
  cover_image_url text,
  cover_emblem    text DEFAULT '🧭',
  illus_type      text DEFAULT 'guilloche',
  illus_color     text DEFAULT '#4a6fa5',
  illus_opacity   float NOT NULL DEFAULT 0.11
                  CHECK (illus_opacity >= 0 AND illus_opacity <= 0.35),
  paper_color     text NOT NULL DEFAULT '#F5F0E8',
  is_published    boolean NOT NULL DEFAULT false,
  is_free         boolean NOT NULL DEFAULT false,
  price_cents     integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- PASSPORT PAGES (geographic sections)
-- ─────────────────────────────────────────────
CREATE TABLE public.passport_pages (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  passport_id       uuid NOT NULL REFERENCES public.passports(id) ON DELETE CASCADE,
  page_order        integer NOT NULL DEFAULT 0,
  section_name      text NOT NULL,
  section_tagline   text,
  prize_description text,
  prize_redeemable_location_ids uuid[],
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(passport_id, page_order)
);

-- ─────────────────────────────────────────────
-- STOPS (individual location boxes)
-- Each stop is a location box on a page.
-- The location box IS the bounding box for stamp placement.
-- Stamp center must fall within it; edges may bleed freely outside.
-- ─────────────────────────────────────────────
CREATE TABLE public.stops (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id           uuid NOT NULL REFERENCES public.passport_pages(id) ON DELETE CASCADE,
  stop_order        integer NOT NULL DEFAULT 0,
  name              text NOT NULL,
  year_established  text,
  location_name     text,
  description       text,
  -- Evidence tier: 1=Precise GPS+QR, 2=QR+Property GPS, 3=GPS radius,
  --                4=Employee verified, 5=Honor system
  evidence_tier     integer NOT NULL DEFAULT 2
                    CHECK (evidence_tier BETWEEN 1 AND 5),
  target_location   geography(Point, 4326),
  radius_meters     float NOT NULL DEFAULT 150,
  qr_code_id        text UNIQUE,
  stamp_icon        text NOT NULL DEFAULT '🍺',
  stamp_color       text NOT NULL DEFAULT '#1D9E75',
  stamp_shape       text NOT NULL DEFAULT 'circle'
                    CHECK (stamp_shape IN ('circle','rectangle','hexagon','badge')),
  stamp_rotation_fixed    float,
  stamp_rotation_range    float DEFAULT 5,
  stamp_smudge      text NOT NULL DEFAULT 'light'
                    CHECK (stamp_smudge IN ('none','light','medium','heavy')),
  verification_type text DEFAULT 'presence'
                    CHECK (verification_type IN ('witnessed','documented','presence','honor')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- COLLECTOR PASSPORTS (user has a copy of a passport)
-- ─────────────────────────────────────────────
CREATE TABLE public.collector_passports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  passport_id     uuid NOT NULL REFERENCES public.passports(id),
  acquired_at     timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  UNIQUE(user_id, passport_id)
);

-- ─────────────────────────────────────────────
-- STAMPS
-- CRITICAL PRIVACY: Store geohash only — not precise coordinates.
-- stamp_pos_x/y = percentage offset within location box bounding area.
-- Center must be within box; edges may bleed outside freely.
-- ─────────────────────────────────────────────
CREATE TABLE public.stamps (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id),
  stop_id               uuid NOT NULL REFERENCES public.stops(id),
  collector_passport_id uuid NOT NULL REFERENCES public.collector_passports(id),
  geohash               text,
  stamp_pos_x           float,
  stamp_pos_y           float,
  contact_size_px       float,
  rotation_deg          float DEFAULT 0,
  verification_method   text NOT NULL DEFAULT 'qr_gps'
                        CHECK (verification_method IN ('qr_gps','gps_only','employee','self_reported')),
  verifier_id           uuid REFERENCES public.profiles(id),
  verifier_note         text,
  stop_opened_at        timestamptz,
  verified_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, stop_id)
);

-- ─────────────────────────────────────────────
-- JOURNAL ENTRIES
-- ─────────────────────────────────────────────
CREATE TABLE public.journal_entries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stamp_id        uuid NOT NULL REFERENCES public.stamps(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id),
  body            text,
  mood_rating     integer CHECK (mood_rating BETWEEN 1 AND 5),
  photo_urls      text[] DEFAULT '{}',
  input_method    text DEFAULT 'keyboard'
                  CHECK (input_method IN ('keyboard','voice','both')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- REDEMPTION TOKENS
-- Single-use. Two required steps: stamp verification + prize distribution.
-- ─────────────────────────────────────────────
CREATE TABLE public.redemption_tokens (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id),
  page_id               uuid NOT NULL REFERENCES public.passport_pages(id),
  token_code            text UNIQUE NOT NULL,
  scanned_at            timestamptz,
  scanned_by_employee   uuid REFERENCES public.employee_accounts(id),
  prize_distributed_at  timestamptz,
  prize_given           text,
  distributed_by        uuid REFERENCES public.employee_accounts(id),
  distribution_location_id uuid,
  extra_gift_card_cents integer,
  employee_note         text,
  distribution_pending  boolean NOT NULL DEFAULT false,
  location_whitelist    uuid[],
  expires_at            timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- Privacy is structural, not policy.
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proprietors ENABLE ROW LEVEL SECURITY;

-- Profiles: users read/update own profile only
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Proprietors: publicly readable
CREATE POLICY "proprietors_read" ON public.proprietors
  FOR SELECT USING (true);

-- Passports: published passports readable by all; creator manages own
CREATE POLICY "passports_read_published" ON public.passports
  FOR SELECT USING (is_published = true OR creator_id = auth.uid());
CREATE POLICY "passports_creator_manage" ON public.passports
  FOR ALL USING (creator_id = auth.uid());

-- Pages: readable if passport is published or user is creator
CREATE POLICY "pages_read" ON public.passport_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id
      AND (p.is_published = true OR p.creator_id = auth.uid())
    )
  );
CREATE POLICY "pages_creator_manage" ON public.passport_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passports p
      WHERE p.id = passport_id AND p.creator_id = auth.uid()
    )
  );

-- Stops: readable if passport is published or user is creator
CREATE POLICY "stops_read" ON public.stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id
      AND (p.is_published = true OR p.creator_id = auth.uid())
    )
  );
CREATE POLICY "stops_creator_manage" ON public.stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.passport_pages pp
      JOIN public.passports p ON p.id = pp.passport_id
      WHERE pp.id = page_id AND p.creator_id = auth.uid()
    )
  );

-- Collector passports: users see only their own
CREATE POLICY "collector_passports_own" ON public.collector_passports
  FOR ALL USING (user_id = auth.uid());

-- Stamps: users see only their own (geohash only — no precise coordinates stored)
CREATE POLICY "stamps_own" ON public.stamps
  FOR ALL USING (user_id = auth.uid());

-- Journal entries: users see only their own
-- PRIVACY: Okuji never reads journal content
CREATE POLICY "journal_own" ON public.journal_entries
  FOR ALL USING (user_id = auth.uid());

-- Redemption tokens: user sees own; employee sees tokens for their proprietor
CREATE POLICY "tokens_own" ON public.redemption_tokens
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employee_accounts ea
      WHERE ea.user_id = auth.uid()
      AND ea.is_active = true
    )
  );
CREATE POLICY "tokens_user_insert" ON public.redemption_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tokens_employee_update" ON public.redemption_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.employee_accounts ea
      WHERE ea.user_id = auth.uid()
      AND ea.is_active = true
    )
  );

-- Employee accounts: employees see their own account
CREATE POLICY "employee_own" ON public.employee_accounts
  FOR SELECT USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX stamps_user_idx ON public.stamps(user_id);
CREATE INDEX stamps_stop_idx ON public.stamps(stop_id);
CREATE INDEX journal_stamp_idx ON public.journal_entries(stamp_id);
CREATE INDEX journal_user_idx ON public.journal_entries(user_id);
CREATE INDEX tokens_code_idx ON public.redemption_tokens(token_code);
CREATE INDEX tokens_pending_idx ON public.redemption_tokens(distribution_pending)
  WHERE distribution_pending = true;
CREATE INDEX stops_location_idx ON public.stops USING GIST(target_location);

-- ─────────────────────────────────────────────
-- POSTGIS HELPER FUNCTION
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_gps_within_radius(
  user_lat float,
  user_lng float,
  stop_id uuid,
  radius_m float
) RETURNS boolean AS $$
  SELECT ST_DWithin(
    s.target_location::geography,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
    radius_m
  )
  FROM public.stops s
  WHERE s.id = stop_id;
$$ LANGUAGE sql STABLE;

-- ─────────────────────────────────────────────
-- TRIGGER: updated_at auto-update
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER passports_updated_at BEFORE UPDATE ON public.passports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER journal_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────
INSERT INTO public.proprietors (name, slug, tier)
VALUES ('McMenamins', 'mcmenamins', 'commercial')
ON CONFLICT (slug) DO NOTHING;
