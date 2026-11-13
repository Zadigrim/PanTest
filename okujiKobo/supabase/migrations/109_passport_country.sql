-- Passport-level country code.
--
-- The okuji-official city passport loader (okujiKobo/scripts/passport-pipeline)
-- writes passports.country, but no migration created it: 042 added country to
-- stops only. Applied by hand in the Supabase SQL editor on 2026-11-13; this file
-- records it so the repo matches the live schema.
--
-- ISO 3166-1 alpha-2 (e.g. 'DE'). Nullable; existing rows stay NULL. No app code
-- reads it yet. Stops keep their own country name in stops.country.

ALTER TABLE public.passports
  ADD COLUMN IF NOT EXISTS country text;

COMMENT ON COLUMN public.passports.country IS
  'ISO 3166-1 alpha-2 country code for the passport as a whole (e.g. DE). Nullable; existing rows stay NULL. Stops keep their own country name in stops.country.';
