-- 112_passport_location.sql
--
-- Passport-level location: explicit country + region on passports, so the
-- designer's passport library (/design) can filter by location. Until now a
-- passport's "where" was only implicit in its stops' coordinates/address
-- (migrations 008/014/042); there was no passport-scoped location.
--
-- DESIGN:
--   * country — ISO 3166-1 alpha-2 (e.g. 'US', 'MX'). Nullable; NULL = unset.
--   * region  — ISO 3166-2 subdivision, stored as the FULL code with its
--               country prefix (e.g. 'US-WA'), so it is self-describing and a
--               future marketplace filter can parse it. Nullable; NULL = unset.
--   * Both NULL => the "No location set" bucket in the filter. Nothing is
--     derived or backfilled — the creator sets these in the designer, so
--     existing passports stay unset (visible, not hidden) until assigned.
--
-- Additive only: nullable columns + format CHECKs, no data mutation, no RLS
-- change (existing passports policies already cover these columns). Mirrors the
-- migration-110 availability-window pattern (passport-level nullable fields set
-- in PassportSettingsPanel, persisted via lib/design/persist.ts saveAll).
--
-- The region CHECK also enforces honesty: a region may not exist without a
-- country, and its prefix must match that country (no 'US-WA' under country
-- 'CA'). Scoped to /design UI; schema is shaped to be shared with Explore later.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS country text,   -- ISO 3166-1 alpha-2, nullable
  ADD COLUMN IF NOT EXISTS region  text;   -- ISO 3166-2, e.g. 'US-WA', nullable

ALTER TABLE public.passports DROP CONSTRAINT IF EXISTS passports_country_format_chk;
ALTER TABLE public.passports ADD CONSTRAINT passports_country_format_chk
  CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');

ALTER TABLE public.passports DROP CONSTRAINT IF EXISTS passports_region_format_chk;
ALTER TABLE public.passports ADD CONSTRAINT passports_region_format_chk
  CHECK (region IS NULL OR (country IS NOT NULL AND region LIKE country || '-%'));
