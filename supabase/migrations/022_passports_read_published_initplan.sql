-- Migration 022: InitPlan-wrap auth.uid() in passports_read_published
--
-- The Supabase database advisor flags this policy (from migration 001)
-- for re-evaluating auth.uid() per row:
--
--   CREATE POLICY "passports_read_published" ON public.passports
--     FOR SELECT USING (is_published = true OR creator_id = auth.uid());
--
-- A bare auth.uid() in a USING clause is planned as a per-row
-- expression, so it runs once for every candidate row. Wrapping it in a
-- scalar subquery — (select auth.uid()) — lets the planner hoist it to a
-- single InitPlan evaluated once per statement. Same technique as the
-- web-side migration 078; logically identical (same rows visible), so
-- the mobile client needs no change and no new binary — this is a
-- planner-only optimization.
--
-- ROLLBACK: recreate with the bare auth.uid() form from migration 001.

DROP POLICY IF EXISTS "passports_read_published" ON public.passports;
CREATE POLICY "passports_read_published" ON public.passports
  FOR SELECT USING (is_published = true OR creator_id = (select auth.uid()));
