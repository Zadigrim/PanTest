-- Migration 024: drop the redundant stops_creator_manage policy (again)
--
-- Regression fix. Migration 050 (web tree) intentionally dropped
-- public.stops policy "stops_creator_manage" because stops had TWO
-- permissive FOR ALL policies — stops_creator and stops_creator_manage —
-- and Postgres evaluates every permissive policy's USING clause on each
-- UPDATE. Each ran a multi-join EXISTS/IN subquery against
-- passport_pages + passports; the compounded cost tripped the 8s
-- statement timeout (57014) on single-field saves like { lng } / { box_x }.
-- stops_creator_manage is a strict subset of stops_creator's creator
-- branch, so dropping it halves the per-row UPDATE cost with no change
-- to the access surface.
--
-- Migration 023 (this tree) then RE-CREATED stops_creator_manage while
-- sweeping auth.uid() wraps from the mobile migration files — it
-- reproduced the policy from 001 without accounting for 050 having
-- removed it on the shared database. That reintroduced the exact 57014
-- timeout 050 had fixed. This migration restores 050's intent.
--
-- Idempotent + guarded (stops may be absent on a drifted database).
-- ROLLBACK: re-create stops_creator_manage from migration 023 — but
-- don't, that is the bug.

DO $do$ BEGIN
  IF to_regclass('public.stops') IS NOT NULL THEN
    DROP POLICY IF EXISTS "stops_creator_manage" ON public.stops;
  END IF;
END $do$;
