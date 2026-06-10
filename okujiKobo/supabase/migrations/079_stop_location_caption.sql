-- Migration 079: optional per-stop location caption on the LocationBox
--
-- Adds two additive, default-off columns to public.stops so a designer
-- can show a small caption on a stop's LocationBox — either the stop's
-- single-line address or its lat/long. Default 'off' means every
-- existing stop renders exactly as before; this is purely additive.
--
--   location_caption_mode      off | address | coordinates  (default off)
--   location_caption_placement interior | exterior          (default interior)
--
-- The address/coordinate DATA already lives on stops (address_street,
-- address_city, …, lat, lng); these columns only carry the per-stop
-- display choice. Consumed by the kobo designer canvas, the print PDF,
-- and the mobile collector renderer (single-source caption formatter).
--
-- Idempotent: IF NOT EXISTS columns + guarded CHECK constraints.
-- ROLLBACK: ALTER TABLE public.stops DROP COLUMN location_caption_mode,
--           DROP COLUMN location_caption_placement.

ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS location_caption_mode text NOT NULL DEFAULT 'off';
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS location_caption_placement text NOT NULL DEFAULT 'interior';

DO $$ BEGIN
  ALTER TABLE public.stops
    ADD CONSTRAINT stops_location_caption_mode_check
    CHECK (location_caption_mode IN ('off','address','coordinates'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stops
    ADD CONSTRAINT stops_location_caption_placement_check
    CHECK (location_caption_placement IN ('interior','exterior'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
