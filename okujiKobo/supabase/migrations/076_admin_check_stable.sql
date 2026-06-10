-- Migration 076: mark is_admin / is_platform_admin as STABLE
--
-- Both functions are called per-row by every RLS policy that uses
-- the admin clause (passports, passport_pages, stops, design_assets,
-- print_jobs, autosaves, etc). VOLATILE (the Postgres default for
-- SECURITY DEFINER) forces re-evaluation on every row — so an UPDATE
-- on a 28-stop passport could execute is_admin() 28+ times even
-- though the answer doesn't change within a transaction.
--
-- STABLE tells Postgres: result depends only on inputs + DB state
-- and is constant within a single SQL statement. Safe for both
-- functions — they read profiles.is_platform_admin for auth.uid()
-- and do not modify state.
--
-- IMMUTABLE would be too strong (DB state can change between
-- statements; an admin grant/revoke would not be picked up).
--
-- ROLLBACK: ALTER FUNCTION ... VOLATILE on both. Safe; reverts to
-- prior planner behavior.

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.is_admin() STABLE';
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER FUNCTION public.is_platform_admin() STABLE';
EXCEPTION WHEN undefined_function THEN NULL; END $$;
