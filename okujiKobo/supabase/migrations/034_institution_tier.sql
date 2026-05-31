-- Phase 1, BLD-05: institution tier classification.
--
-- Per Appendix L.5 there are three institutional tiers — Civic, Municipal,
-- Business — plus a 'pending' state for institutions that exist in the
-- platform but haven't been classified yet. Per DEC-02 (2026-05-30) all
-- institutional onboarding is manual review by Nathan in v1; the tier is
-- set explicitly when Nathan creates the institution row through the
-- platform-admin UI. There is no automatic classification at signup.
--
-- Backfill: any existing institution rows get tier = 'pending'. Nathan
-- will update them manually post-migration.
--
-- Note: the existing institutions.tier column from the legacy schema (if
-- any) used different values ('community' | 'commercial' | 'enterprise').
-- Migration 032 backfilled token_prefix from proprietors but did not
-- touch the legacy tier values. This migration's CHECK rejects the
-- legacy values; the same UPDATE below normalizes any pre-existing rows
-- to 'pending' before the CHECK is applied.

-- Drop any pre-existing tier column from earlier schema migrations so we
-- can install the canonical form. Using IF EXISTS guards greenfield apply.
ALTER TABLE public.institutions
  DROP COLUMN IF EXISTS tier;

ALTER TABLE public.institutions
  ADD COLUMN tier text NOT NULL DEFAULT 'pending';

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_tier_check
  CHECK (tier IN ('civic', 'municipal', 'business', 'pending'));
