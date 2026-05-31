-- Phase 1, DEC-18 RLS expansion: institutional employees with
-- can_design = true can edit content their institution owns.
--
-- Scope: passports, passport_pages, stops, passport_autosaves —
-- the core passport-content tables. Plus print_jobs and design_assets,
-- which carry institution_id directly (decided in discovery):
--   print_jobs.institution_id is the institution that owns the job;
--   design_assets.institution_id is the institution that owns the asset.
-- For both, employees with can_design at that institution may modify
-- the rows so artifacts survive employee turnover.
--
-- Critical scoping: every expansion is gated on the relevant
-- "institution-owned" predicate (proprietor_id IS NOT NULL on passports,
-- institution_id IS NOT NULL on print_jobs / design_assets). Personal
-- (non-institutional) content retains strict owner-only semantics.

-- ─────────────────────────────────────────────────────────────────────
-- passports
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "passports_creator" ON public.passports;
CREATE POLICY "passports_creator" ON public.passports
  FOR ALL USING (
    creator_id = auth.uid()
    OR public.is_admin() = true
    OR (
      proprietor_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.employee_authorizations ea
         WHERE ea.user_id = auth.uid()
           AND ea.institution_id = passports.proprietor_id
           AND ea.can_design = true
      )
    )
  );

-- passports_public_read unchanged from 012_blockpoint4.sql.

-- ─────────────────────────────────────────────────────────────────────
-- passport_pages
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pages_creator" ON public.passport_pages;
CREATE POLICY "pages_creator" ON public.passport_pages
  FOR ALL USING (
    public.is_admin() = true
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = auth.uid()
    )
    OR passport_id IN (
      SELECT p.id FROM public.passports p
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = auth.uid()
              AND ea.institution_id = p.proprietor_id
              AND ea.can_design = true
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- stops
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stops_creator" ON public.stops;
CREATE POLICY "stops_creator" ON public.stops
  FOR ALL USING (
    public.is_admin() = true
    OR page_id IN (
      SELECT pp.id FROM public.passport_pages pp
        JOIN public.passports p ON p.id = pp.passport_id
       WHERE p.creator_id = auth.uid()
    )
    OR page_id IN (
      SELECT pp.id FROM public.passport_pages pp
        JOIN public.passports p ON p.id = pp.passport_id
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = auth.uid()
              AND ea.institution_id = p.proprietor_id
              AND ea.can_design = true
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- passport_autosaves
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "autosaves_own" ON public.passport_autosaves;
CREATE POLICY "autosaves_own" ON public.passport_autosaves
  FOR ALL USING (
    public.is_admin() = true
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = auth.uid()
    )
    OR passport_id IN (
      SELECT p.id FROM public.passports p
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = auth.uid()
              AND ea.institution_id = p.proprietor_id
              AND ea.can_design = true
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- print_jobs — expanded per (α) decision in discovery
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "print_jobs_own" ON public.print_jobs;
CREATE POLICY "print_jobs_own" ON public.print_jobs
  FOR ALL USING (
    created_by = auth.uid()
    OR public.is_admin() = true
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = auth.uid()
         AND ea.institution_id = print_jobs.institution_id
         AND ea.can_design = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- design_assets — write expansion per (α) decision in discovery
-- (Read policy "design_assets_institution_read" already grants
-- institution-wide read; this expansion is for the OR-ALL clause that
-- gates UPDATE/DELETE.)
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "design_assets_owner" ON public.design_assets;
CREATE POLICY "design_assets_owner" ON public.design_assets
  FOR ALL USING (
    owner_id = auth.uid()
    OR public.is_admin() = true
    OR (
      institution_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.employee_authorizations ea
         WHERE ea.user_id = auth.uid()
           AND ea.institution_id = design_assets.institution_id
           AND ea.can_design = true
      )
    )
  );
