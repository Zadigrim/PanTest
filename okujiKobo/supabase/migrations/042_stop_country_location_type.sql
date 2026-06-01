-- International location fields + explicit location type on stops.
--
-- Two columns added in one migration since both serve the designer's
-- location-model refactor:
--
--   country         — was implicitly US-only (no column existed); a
--                     creator building a Mazatlán, Mexico passport had no
--                     way to record the country. Nullable; existing rows
--                     stay NULL.
--
--   location_type   — declarative tag for how a stop is located:
--                       'address'      → human-readable place fields
--                       'coordinates'  → GPS lat/lng target
--                       'honor'        → self-reported, no location data
--                     Drives field visibility/requirement in the designer.
--                     Nullable: existing stops have no value and the UI
--                     derives a sensible default at render time
--                     (coordinates if lat/lng set, else address).
--
-- This migration does NOT touch verification_tier semantics or the
-- verify-stamp Edge Function. Honor-system stops set verification_tier=5
-- in the designer (verify-stamp already treats tier 5 as the
-- self-reported bypass) — wiring lives in the form, not the DB.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS country       text,
  ADD COLUMN IF NOT EXISTS location_type text;

ALTER TABLE public.stops
  DROP CONSTRAINT IF EXISTS stops_location_type_check;
ALTER TABLE public.stops
  ADD CONSTRAINT stops_location_type_check
  CHECK (location_type IS NULL OR location_type IN ('address', 'coordinates', 'honor'));
