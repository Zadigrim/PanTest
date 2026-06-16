-- 090_passport_award_columns.sql
--
-- Reconcile migration drift. estimated_hours / traveler_types /
-- award_year / shortlisted are declared on public.passports in both
-- okuji-db/000_baseline.sql and 002_connect_schema.sql, are present in
-- the hand-written Passport type (lib/supabase/types.ts), and are
-- rendered across the marketplace + explore surfaces (PassportCard,
-- LibraryCard, passport/[id], explore, explore/[id]) — yet they are
-- ABSENT from the live schema / regenerated types. The columns return
-- undefined at runtime, so every award / shortlisted / estimated-hours
-- badge silently never renders.
--
-- This re-declares them idempotently so live converges with the code
-- and the baseline. Additive and safe: ADD COLUMN IF NOT EXISTS is a
-- no-op if a column already exists; existing rows get NULL (or false
-- for shortlisted), which renders identically to today until populated.
--
-- Types mirror the baseline definitions.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS estimated_hours float,
  ADD COLUMN IF NOT EXISTS traveler_types  text[],
  ADD COLUMN IF NOT EXISTS award_year      integer,
  ADD COLUMN IF NOT EXISTS shortlisted     boolean NOT NULL DEFAULT false;
