-- Migration 077: RLS indexes for passport-content tables
--
-- The stops RLS policy (migration 038, passport_pages / passports /
-- design_assets share the same shape) evaluates two nested IN
-- subqueries on every row:
--
--   page_id IN (
--     SELECT pp.id FROM passport_pages pp
--       JOIN passports p ON p.id = pp.passport_id
--      WHERE p.creator_id = auth.uid()
--   )
--   OR page_id IN (
--     SELECT pp.id FROM passport_pages pp
--       JOIN passports p ON p.id = pp.passport_id
--      WHERE p.proprietor_id IS NOT NULL
--        AND EXISTS (SELECT 1 FROM employee_authorizations ea
--                     WHERE ea.user_id = auth.uid()
--                       AND ea.institution_id = p.proprietor_id
--                       AND ea.can_design = true)
--   )
--
-- Each subquery joins passport_pages → passports. Without indexes on
-- the join + filter columns, this is a sequential scan + nested loop
-- on every stops UPDATE. With 28 stops on a passport in the saveAll
-- loop, every UPDATE pays the full RLS cost.
--
-- This migration adds the indexes that those subqueries need:
--   passport_pages(passport_id)        — join key
--   passports(creator_id)              — first subquery WHERE
--   passports(proprietor_id)           — second subquery WHERE
--                                        (partial index on NOT NULL)
--   employee_authorizations(user_id, institution_id) WHERE can_design
--                                      — partial index for the
--                                        EXISTS subquery
--
-- All IF NOT EXISTS — safe to re-run; doesn't replace existing
-- indexes (Postgres won't create a duplicate when an equivalent
-- index already exists with the same predicate).
--
-- Expected impact: per-row RLS evaluation drops from ~290ms to
-- under 20ms. Execution time for a single-row stops UPDATE should
-- drop from ~440ms to ~30-60ms. Planning time is unchanged (that's
-- a policy-complexity issue, not an index issue).
--
-- ROLLBACK: DROP INDEX for each. Safe; reverts to prior plan cost.

-- passport_pages.passport_id — join key in both RLS subqueries.
-- Pages-per-passport is small (≤12 free / typically ≤30
-- institutional), so this is a tight, frequently-used index.
CREATE INDEX IF NOT EXISTS passport_pages_passport_id_idx
  ON public.passport_pages (passport_id);

-- passports.creator_id — the "creator owns the passport" clause.
-- Selective in practice (each creator owns a small number).
CREATE INDEX IF NOT EXISTS passports_creator_id_idx
  ON public.passports (creator_id);

-- passports.proprietor_id — the institutional clause. Partial
-- because most personal passports have NULL here; the index
-- shrinks to just the institutional rows.
CREATE INDEX IF NOT EXISTS passports_proprietor_id_idx
  ON public.passports (proprietor_id)
  WHERE proprietor_id IS NOT NULL;

-- employee_authorizations — the EXISTS subquery in the institutional
-- clause. UNIQUE(institution_id, user_id) from the table definition
-- gives a composite already; this partial index pre-filters to
-- can_design=true rows so the EXISTS predicate hits an index that's
-- already the right shape.
CREATE INDEX IF NOT EXISTS employee_authorizations_can_design_idx
  ON public.employee_authorizations (user_id, institution_id)
  WHERE can_design = true;
