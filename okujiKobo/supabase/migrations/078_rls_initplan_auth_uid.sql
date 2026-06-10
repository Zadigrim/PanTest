-- Migration 078: wrap auth.uid() / is_admin() in scalar subqueries so
-- they evaluate once per statement (InitPlan), not once per row.
--
-- Follows 076 (is_admin/is_platform_admin → STABLE) and 077 (RLS join
-- indexes). 077's own note called out that the remaining lever was the
-- policy itself, not more indexes — this is that lever.
--
-- The live policies from migration 038 (passports/passport_pages/stops/
-- passport_autosaves/print_jobs/design_assets — still current; 050 only
-- dropped a redundant duplicate) call auth.uid() and public.is_admin()
-- BARE, inline in every clause including the nested IN / EXISTS
-- subqueries. Per Supabase's RLS-performance guidance, a bare volatile-
-- looking call in a USING clause is re-planned as a per-row expression
-- and re-evaluated for every candidate row. Wrapping it in a scalar
-- subquery — (select auth.uid()) — lets the planner hoist it to a
-- single InitPlan evaluated once for the whole statement. On a 28-stop
-- saveAll (one serialized UPDATE per stop) that per-row cost compounds
-- across the entire batch, so the win is multiplied.
--
-- These rewrites are LOGICALLY IDENTICAL to the 038 definitions: same
-- owner/creator clause, same admin gate (is_admin — invariant #4
-- untouched), same employee-authorization EXISTS. Only the evaluation
-- strategy changes. No semantic change to who can read or write.
--
-- ROLLBACK: re-run migration 038's CREATE POLICY statements (the bare
-- forms). Safe; reverts to prior per-row planner behavior.

-- ─────────────────────────────────────────────────────────────────────
-- passports
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "passports_creator" ON public.passports;
CREATE POLICY "passports_creator" ON public.passports
  FOR ALL USING (
    creator_id = (select auth.uid())
    OR (select public.is_admin())
    OR (
      proprietor_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.employee_authorizations ea
         WHERE ea.user_id = (select auth.uid())
           AND ea.institution_id = passports.proprietor_id
           AND ea.can_design = true
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- passport_pages
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pages_creator" ON public.passport_pages;
CREATE POLICY "pages_creator" ON public.passport_pages
  FOR ALL USING (
    (select public.is_admin())
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = (select auth.uid())
    )
    OR passport_id IN (
      SELECT p.id FROM public.passports p
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = (select auth.uid())
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
    (select public.is_admin())
    OR page_id IN (
      SELECT pp.id FROM public.passport_pages pp
        JOIN public.passports p ON p.id = pp.passport_id
       WHERE p.creator_id = (select auth.uid())
    )
    OR page_id IN (
      SELECT pp.id FROM public.passport_pages pp
        JOIN public.passports p ON p.id = pp.passport_id
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = (select auth.uid())
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
    (select public.is_admin())
    OR passport_id IN (
      SELECT id FROM public.passports WHERE creator_id = (select auth.uid())
    )
    OR passport_id IN (
      SELECT p.id FROM public.passports p
       WHERE p.proprietor_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.employee_authorizations ea
            WHERE ea.user_id = (select auth.uid())
              AND ea.institution_id = p.proprietor_id
              AND ea.can_design = true
         )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- print_jobs
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "print_jobs_own" ON public.print_jobs;
CREATE POLICY "print_jobs_own" ON public.print_jobs
  FOR ALL USING (
    created_by = (select auth.uid())
    OR (select public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.employee_authorizations ea
       WHERE ea.user_id = (select auth.uid())
         AND ea.institution_id = print_jobs.institution_id
         AND ea.can_design = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- design_assets
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "design_assets_owner" ON public.design_assets;
CREATE POLICY "design_assets_owner" ON public.design_assets
  FOR ALL USING (
    owner_id = (select auth.uid())
    OR (select public.is_admin())
    OR (
      institution_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.employee_authorizations ea
         WHERE ea.user_id = (select auth.uid())
           AND ea.institution_id = design_assets.institution_id
           AND ea.can_design = true
      )
    )
  );
