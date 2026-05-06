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

-- ─── design_assets: add built-in flag + additional columns ───────────────────
ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS is_built_in    boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS file_format    text,
  ADD COLUMN IF NOT EXISTS thumbnail_data text,
  ADD COLUMN IF NOT EXISTS is_monochrome  boolean;

-- ─── stops: stamp asset reference ────────────────────────────────────────────
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS stamp_asset_id uuid REFERENCES public.design_assets(id),
  ADD COLUMN IF NOT EXISTS stamp_type text NOT NULL DEFAULT 'emoji'
    CHECK (stamp_type IN ('emoji', 'custom_asset'));

-- ─── Index for stamp asset lookups ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS design_assets_stamp_type_idx
  ON public.design_assets (asset_type, owner_id)
  WHERE asset_type = 'stamp';
