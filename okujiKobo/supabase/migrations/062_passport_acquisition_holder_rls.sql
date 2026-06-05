-- Migration 062: holder-acquisition RLS branches
--
-- Phase-1 fix for the unpublish→republish lifecycle.
--
-- The shipped passports / passport_pages / stops RLS policies
-- (migration 012_blockpoint4.sql lines 283-323) gate
-- SELECT access on `passports.is_published = true`. Migration
-- 049's docblock claims existing holders see passports via
-- "the collector-acquired RLS branch" — but that branch was
-- never written. So today, unpublishing a passport would
-- BLOCK holders from reading any of:
--   passports (the row itself)
--   passport_pages (their pages)
--   stops (the stops they earned stamps at)
--
-- Spec invariant: holders NEVER lose access to an acquired
-- passport. This migration adds the missing acquired-branch
-- SELECT policies, OR'd with the existing public-read
-- predicates.
--
-- The verify-stamp Edge Function (supabase/functions/verify-stamp)
-- already uses collector_passports for ownership — it survives
-- unpublish unchanged.
--
-- ROLLBACK: DROP the three new policies. Holders lose access
-- on unpublish again — only safe if no passport is currently
-- in the unpublished state.

-- ── passports ───────────────────────────────────────────────
-- The existing passports_public_read keeps its OR-chain:
--   is_published = true OR creator_id = auth.uid() OR is_admin()
-- This adds a parallel policy granting SELECT when the user
-- has acquired the passport via EITHER track (acquisitions
-- for the Connect web flow, collector_passports for the Expo
-- mobile flow — both populated by /api/acquire + checkout).
DROP POLICY IF EXISTS "passports_acquired_read" ON public.passports;
CREATE POLICY "passports_acquired_read" ON public.passports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.acquisitions a
      WHERE a.user_id = auth.uid() AND a.passport_id = passports.id
    )
    OR EXISTS (
      SELECT 1 FROM public.collector_passports cp
      WHERE cp.user_id = auth.uid() AND cp.passport_id = passports.id
    )
  );

-- ── passport_pages ──────────────────────────────────────────
-- Same logic, walked through page → passport.
DROP POLICY IF EXISTS "pages_acquired_read" ON public.passport_pages;
CREATE POLICY "pages_acquired_read" ON public.passport_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.acquisitions a
      WHERE a.user_id = auth.uid() AND a.passport_id = passport_pages.passport_id
    )
    OR EXISTS (
      SELECT 1 FROM public.collector_passports cp
      WHERE cp.user_id = auth.uid() AND cp.passport_id = passport_pages.passport_id
    )
  );

-- ── stops ───────────────────────────────────────────────────
-- Walked through stop → page → passport.
DROP POLICY IF EXISTS "stops_acquired_read" ON public.stops;
CREATE POLICY "stops_acquired_read" ON public.stops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.passport_pages pp
      JOIN public.acquisitions a ON a.passport_id = pp.passport_id
      WHERE pp.id = stops.page_id AND a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.passport_pages pp
      JOIN public.collector_passports cp ON cp.passport_id = pp.passport_id
      WHERE pp.id = stops.page_id AND cp.user_id = auth.uid()
    )
  );
